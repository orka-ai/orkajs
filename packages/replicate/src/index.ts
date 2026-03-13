import type {
  LLMAdapter,
  LLMGenerateOptions,
  LLMResult,
  StreamingLLMAdapter,
  StreamGenerateOptions,
  StreamResult,
  LLMStreamEvent,
  TokenEvent,
  ContentEvent,
  DoneEvent,
  ErrorEvent as OrkaErrorEvent,
} from '@orka-js/core';
import { createStreamEvent } from '@orka-js/core';

export interface ReplicateAdapterConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  timeoutMs?: number;
  pollingIntervalMs?: number;
}

export class ReplicateAdapter implements LLMAdapter, StreamingLLMAdapter {
  readonly name = 'replicate';
  readonly supportsStreaming = true;
  private apiKey: string;
  private model: string;
  private baseURL: string;
  private timeoutMs: number;
  private pollingIntervalMs: number;

  constructor(config: ReplicateAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'meta/llama-2-70b-chat';
    this.baseURL = config.baseURL ?? 'https://api.replicate.com/v1';
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.pollingIntervalMs = config.pollingIntervalMs ?? 1000;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const input = this.buildInput(prompt, options);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/predictions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          version: this.getModelVersion(),
          input,
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Replicate API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    }

    if (!response.ok) {
      clearTimeout(timeout);
      const error = await response.text();
      throw new Error(`Replicate API error: ${response.status} - ${error}`);
    }

    const prediction = await response.json() as { id: string; status: string };
    const result = await this.pollForCompletion(prediction.id, controller.signal);
    clearTimeout(timeout);

    const content = Array.isArray(result.output) ? result.output.join('') : result.output ?? '';

    return {
      content,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      model: this.model,
      finishReason: 'stop',
    };
  }

  async embed(_texts: string | string[]): Promise<number[][]> {
    throw new Error('Replicate adapter does not support embeddings directly. Use a dedicated embedding model.');
  }

  async *stream(prompt: string, options: StreamGenerateOptions = {}): AsyncIterable<LLMStreamEvent> {
    const input = this.buildInput(prompt, options as LLMGenerateOptions);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/predictions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Prefer': 'wait',
        },
        body: JSON.stringify({
          version: this.getModelVersion(),
          input,
          stream: true,
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        yield createStreamEvent<OrkaErrorEvent>('error', {
          error: new Error(`Replicate API request timed out after ${this.timeoutMs}ms`),
          message: `Request timed out after ${this.timeoutMs}ms`,
        });
        return;
      }
      yield createStreamEvent<OrkaErrorEvent>('error', {
        error: error as Error,
        message: (error as Error).message,
      });
      return;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      yield createStreamEvent<OrkaErrorEvent>('error', {
        error: new Error(`Replicate API error: ${response.status} - ${errorText}`),
        message: `Replicate API error: ${response.status}`,
      });
      return;
    }

    const prediction = await response.json() as { id: string; urls?: { stream?: string } };

    if (!prediction.urls?.stream) {
      // Fall back to polling if streaming URL not available
      const result = await this.pollForCompletion(prediction.id, controller.signal);
      const content = Array.isArray(result.output) ? result.output.join('') : result.output ?? '';
      
      yield createStreamEvent<TokenEvent>('token', { token: content, index: 0 });
      yield createStreamEvent<ContentEvent>('content', { content, delta: content, index: 0 });
      yield createStreamEvent<DoneEvent>('done', {
        content,
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });
      return;
    }

    // Stream from the streaming URL
    const streamResponse = await fetch(prediction.urls.stream, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'text/event-stream',
      },
    });

    if (!streamResponse.ok || !streamResponse.body) {
      yield createStreamEvent<OrkaErrorEvent>('error', {
        error: new Error('Failed to connect to stream'),
        message: 'Failed to connect to stream',
      });
      return;
    }

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let tokenIndex = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            if (json.output) {
              const token = json.output;
              content += token;

              yield createStreamEvent<TokenEvent>('token', {
                token,
                index: tokenIndex++,
              });

              options.onToken?.(token, tokenIndex - 1);

              yield createStreamEvent<ContentEvent>('content', {
                content,
                delta: token,
                index: tokenIndex - 1,
              });
            }
          } catch {
            // Raw text output
            if (data && data !== '[DONE]') {
              content += data;
              yield createStreamEvent<TokenEvent>('token', {
                token: data,
                index: tokenIndex++,
              });
              options.onToken?.(data, tokenIndex - 1);
            }
          }
        }
      }

      yield createStreamEvent<DoneEvent>('done', {
        content,
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });

      options.onEvent?.(createStreamEvent<DoneEvent>('done', {
        content,
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }));
    } finally {
      reader.releaseLock();
    }
  }

  async streamGenerate(prompt: string, options: StreamGenerateOptions = {}): Promise<StreamResult> {
    const startTime = Date.now();
    let content = '';
    let tokenIndex = 0;
    let ttft: number | undefined;

    for await (const event of this.stream(prompt, options)) {
      options.onEvent?.(event);

      switch (event.type) {
        case 'token':
          if (ttft === undefined) ttft = Date.now() - startTime;
          content += event.token;
          options.onToken?.(event.token, tokenIndex++);
          break;
        case 'done':
          content = event.content;
          break;
        case 'error':
          throw event.error;
      }
    }

    return {
      content,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: this.model,
      finishReason: 'stop',
      ttft,
      durationMs: Date.now() - startTime,
    };
  }

  private buildInput(prompt: string, options: LLMGenerateOptions): Record<string, unknown> {
    const input: Record<string, unknown> = {
      prompt,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
    };

    if (options.systemPrompt) {
      input.system_prompt = options.systemPrompt;
    }

    if (options.stopSequences) {
      input.stop_sequences = options.stopSequences.join(',');
    }

    return input;
  }

  private getModelVersion(): string {
    // For official models, the version is part of the model string
    // Format: owner/model:version or owner/model
    if (this.model.includes(':')) {
      return this.model.split(':')[1];
    }
    // Return the full model identifier for official models
    return this.model;
  }

  private async pollForCompletion(
    predictionId: string,
    signal: AbortSignal
  ): Promise<{ output: string | string[]; status: string }> {
    while (!signal.aborted) {
      const response = await fetch(`${this.baseURL}/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error(`Replicate API error: ${response.status}`);
      }

      const prediction = await response.json() as {
        status: string;
        output?: string | string[];
        error?: string;
      };

      if (prediction.status === 'succeeded') {
        return { output: prediction.output ?? '', status: prediction.status };
      }

      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error ?? 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs));
    }

    throw new Error('Prediction polling aborted');
  }
}
