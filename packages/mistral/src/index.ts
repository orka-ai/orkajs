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

/** Pricing per 1M tokens in USD (input / output) — updated 2025 */
const MISTRAL_PRICING: Record<string, { input: number; output: number }> = {
  'mistral-large-latest':   { input: 2.00,  output: 6.00  },
  'mistral-large-2411':     { input: 2.00,  output: 6.00  },
  'mistral-medium-latest':  { input: 2.70,  output: 8.10  },
  'mistral-small-latest':   { input: 0.20,  output: 0.60  },
  'mistral-small-2409':     { input: 0.20,  output: 0.60  },
  'open-mistral-7b':        { input: 0.25,  output: 0.25  },
  'open-mixtral-8x7b':      { input: 0.70,  output: 0.70  },
  'open-mixtral-8x22b':     { input: 2.00,  output: 6.00  },
  'codestral-latest':       { input: 0.30,  output: 0.90  },
};

function calcMistralCost(model: string, promptTokens: number, completionTokens: number): number | undefined {
  const pricing = MISTRAL_PRICING[model];
  if (!pricing) return undefined;
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

export interface MistralAdapterConfig {
  apiKey: string;
  model?: string;
  embeddingModel?: string;
  baseURL?: string;
  timeoutMs?: number;
}

export class MistralAdapter implements LLMAdapter, StreamingLLMAdapter {
  readonly name = 'mistral';
  readonly supportsStreaming = true;
  private apiKey: string;
  private model: string;
  private embeddingModel: string;
  private baseURL: string;
  private timeoutMs: number;

  constructor(config: MistralAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'mistral-small-latest';
    this.embeddingModel = config.embeddingModel ?? 'mistral-embed';
    this.baseURL = config.baseURL ?? 'https://api.mistral.ai/v1';
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const messages: Array<{ role: string; content: string }> = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 1024,
          stop: options.stopSequences,
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Mistral API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    const usage = {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      usage,
      model: data.model,
      finishReason: this.mapFinishReason(data.choices[0]?.finish_reason),
      cost: calcMistralCost(data.model, usage.promptTokens, usage.completionTokens),
    };
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    const input = Array.isArray(texts) ? texts : [texts];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/embeddings`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input,
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Mistral Embeddings API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral Embeddings API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return data.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);
  }

  private mapFinishReason(reason: string): LLMResult['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'tool_calls': return 'tool_calls';
      default: return 'stop';
    }
  }

  /**
   * Stream generation - returns an AsyncIterable of stream events
   * Mistral API is OpenAI-compatible for streaming
   */
  async *stream(prompt: string, options: StreamGenerateOptions = {}): AsyncIterable<LLMStreamEvent> {
    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 1024,
          stop: options.stopSequences,
          stream: true,
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        yield createStreamEvent<OrkaErrorEvent>('error', {
          error: new Error(`Mistral API request timed out after ${this.timeoutMs}ms`),
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
        error: new Error(`Mistral API error: ${response.status} - ${errorText}`),
        message: `Mistral API error: ${response.status}`,
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
        let done: boolean;
        let value: Uint8Array | undefined;
        try {
          ({ done, value } = await reader.read());
        } catch (readErr) {
          yield createStreamEvent<OrkaErrorEvent>('error', {
            error: readErr instanceof Error ? readErr : new Error(String(readErr)),
            message: readErr instanceof Error ? readErr.message : String(readErr),
          });
          return;
        }
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));

            if (json.usage) {
              usage = {
                promptTokens: json.usage.prompt_tokens || 0,
                completionTokens: json.usage.completion_tokens || 0,
                totalTokens: json.usage.total_tokens || 0,
              };
              yield createStreamEvent<UsageEvent>('usage', { usage });
            }

            const choice = json.choices?.[0];
            if (!choice) continue;

            if (choice.finish_reason) {
              finishReason = this.mapFinishReason(choice.finish_reason);
            }

            const delta = choice.delta;
            if (delta?.content) {
              const token = delta.content;
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
            // Skip malformed JSON
          }
        }
      }

      const cost = calcMistralCost(this.model, usage.promptTokens, usage.completionTokens);
      yield createStreamEvent<DoneEvent>('done', {
        content,
        finishReason,
        usage,
        cost,
      });

      options.onEvent?.(createStreamEvent<DoneEvent>('done', {
        content,
        finishReason,
        usage,
        cost,
      }));

    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Stream generation with final result
   */
  async streamGenerate(prompt: string, options: StreamGenerateOptions = {}): Promise<StreamResult> {
    const startTime = Date.now();
    let content = '';
    let tokenIndex = 0;
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finishReason: StreamResult['finishReason'] = 'stop';
    let ttft: number | undefined;

    let cost: number | undefined;

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
          cost = event.cost;
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
      cost,
    };
  }
}
