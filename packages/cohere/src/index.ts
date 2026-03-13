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
  UsageEvent,
  DoneEvent,
  ErrorEvent as OrkaErrorEvent,
} from '@orka-js/core';
import { createStreamEvent } from '@orka-js/core';

export interface CohereAdapterConfig {
  apiKey: string;
  model?: string;
  embeddingModel?: string;
  baseURL?: string;
  timeoutMs?: number;
}

export class CohereAdapter implements LLMAdapter, StreamingLLMAdapter {
  readonly name = 'cohere';
  readonly supportsStreaming = true;
  private apiKey: string;
  private model: string;
  private embeddingModel: string;
  private baseURL: string;
  private timeoutMs: number;

  constructor(config: CohereAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'command-r-plus';
    this.embeddingModel = config.embeddingModel ?? 'embed-english-v3.0';
    this.baseURL = config.baseURL ?? 'https://api.cohere.ai/v1';
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const body: Record<string, unknown> = {
      model: this.model,
      message: prompt,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      stop_sequences: options.stopSequences,
    };

    if (options.systemPrompt) {
      body.preamble = options.systemPrompt;
    }

    if (options.messages) {
      body.chat_history = options.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }));
      body.message = prompt;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Cohere API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      text: string;
      finish_reason: string;
      meta?: {
        billed_units?: {
          input_tokens?: number;
          output_tokens?: number;
        };
      };
    };

    return {
      content: data.text,
      usage: {
        promptTokens: data.meta?.billed_units?.input_tokens ?? 0,
        completionTokens: data.meta?.billed_units?.output_tokens ?? 0,
        totalTokens: (data.meta?.billed_units?.input_tokens ?? 0) + (data.meta?.billed_units?.output_tokens ?? 0),
      },
      model: this.model,
      finishReason: this.mapFinishReason(data.finish_reason),
    };
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    const input = Array.isArray(texts) ? texts : [texts];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/embed`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          texts: input,
          input_type: 'search_document',
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Cohere Embeddings API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere Embeddings API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      embeddings: number[][];
    };

    return data.embeddings;
  }

  async *stream(prompt: string, options: StreamGenerateOptions = {}): AsyncIterable<LLMStreamEvent> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const body: Record<string, unknown> = {
      model: this.model,
      message: prompt,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      stop_sequences: options.stopSequences,
      stream: true,
    };

    if (options.systemPrompt) {
      body.preamble = options.systemPrompt;
    }

    if (options.messages) {
      body.chat_history = options.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }));
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        yield createStreamEvent<OrkaErrorEvent>('error', {
          error: new Error(`Cohere API request timed out after ${this.timeoutMs}ms`),
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
        error: new Error(`Cohere API error: ${response.status} - ${errorText}`),
        message: `Cohere API error: ${response.status}`,
      });
      return;
    }

    if (!response.body) {
      yield createStreamEvent<OrkaErrorEvent>('error', {
        error: new Error('No response body'),
        message: 'No response body received',
      });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let tokenIndex = 0;
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finishReason: LLMResult['finishReason'] = 'stop';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const json = JSON.parse(trimmed);

            if (json.event_type === 'text-generation') {
              const token = json.text;
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

            if (json.event_type === 'stream-end') {
              finishReason = this.mapFinishReason(json.finish_reason);
              if (json.response?.meta?.billed_units) {
                usage = {
                  promptTokens: json.response.meta.billed_units.input_tokens ?? 0,
                  completionTokens: json.response.meta.billed_units.output_tokens ?? 0,
                  totalTokens: (json.response.meta.billed_units.input_tokens ?? 0) +
                    (json.response.meta.billed_units.output_tokens ?? 0),
                };
                yield createStreamEvent<UsageEvent>('usage', { usage });
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      yield createStreamEvent<DoneEvent>('done', {
        content,
        finishReason,
        usage,
      });

      options.onEvent?.(createStreamEvent<DoneEvent>('done', {
        content,
        finishReason,
        usage,
      }));
    } finally {
      reader.releaseLock();
    }
  }

  async streamGenerate(prompt: string, options: StreamGenerateOptions = {}): Promise<StreamResult> {
    const startTime = Date.now();
    let content = '';
    let tokenIndex = 0;
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finishReason: StreamResult['finishReason'] = 'stop';
    let ttft: number | undefined;

    for await (const event of this.stream(prompt, options)) {
      options.onEvent?.(event);

      switch (event.type) {
        case 'token':
          if (ttft === undefined) ttft = Date.now() - startTime;
          content += event.token;
          options.onToken?.(event.token, tokenIndex++);
          break;
        case 'usage':
          usage = event.usage;
          break;
        case 'done':
          content = event.content;
          finishReason = event.finishReason;
          if (event.usage) usage = event.usage;
          break;
        case 'error':
          throw event.error;
      }
    }

    return {
      content,
      usage,
      model: this.model,
      finishReason,
      ttft,
      durationMs: Date.now() - startTime,
    };
  }

  private mapFinishReason(reason: string): LLMResult['finishReason'] {
    switch (reason) {
      case 'COMPLETE':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'STOP_SEQUENCE':
        return 'stop';
      default:
        return 'stop';
    }
  }
}
