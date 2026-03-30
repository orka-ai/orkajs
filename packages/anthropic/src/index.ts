import type {
  LLMAdapter,
  LLMGenerateOptions,
  LLMResult,
  ContentPart,
  StreamingLLMAdapter,
  StreamGenerateOptions,
  StreamResult,
  LLMStreamEvent,
  TokenEvent,
  ContentEvent,
  ThinkingEvent,
  UsageEvent,
  DoneEvent,
  ErrorEvent as OrkaErrorEvent,
} from '@orka-js/core';
import { createStreamEvent } from '@orka-js/core';

/** Pricing per 1M tokens in USD (input / output) — updated 2025 */
const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5':              { input: 15.00, output: 75.00 },
  'claude-opus-4-6':              { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5':            { input: 3.00,  output: 15.00 },
  'claude-sonnet-4-6':            { input: 3.00,  output: 15.00 },
  'claude-3-5-sonnet-20241022':   { input: 3.00,  output: 15.00 },
  'claude-3-5-sonnet-20240620':   { input: 3.00,  output: 15.00 },
  'claude-3-5-haiku-20241022':    { input: 0.80,  output: 4.00  },
  'claude-haiku-4-5-20251001':    { input: 0.80,  output: 4.00  },
  'claude-3-opus-20240229':       { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229':     { input: 3.00,  output: 15.00 },
  'claude-3-haiku-20240307':      { input: 0.25,  output: 1.25  },
};

function calcAnthropicCost(model: string, promptTokens: number, completionTokens: number): number | undefined {
  // Match by prefix for versioned models
  const key = Object.keys(ANTHROPIC_PRICING).find(k => model.startsWith(k) || model === k);
  if (!key) return undefined;
  const pricing = ANTHROPIC_PRICING[key];
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

export interface AnthropicAdapterConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  timeoutMs?: number;
}

export class AnthropicAdapter implements LLMAdapter, StreamingLLMAdapter {
  readonly name = 'anthropic';
  readonly supportsStreaming = true;
  private apiKey: string;
  private model: string;
  private baseURL: string;
  private timeoutMs: number;

  constructor(config: AnthropicAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'claude-3-5-sonnet-20241022';
    this.baseURL = config.baseURL ?? 'https://api.anthropic.com';
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    let messages: Array<{ role: string; content: string | unknown[] }>;
    let system = options.systemPrompt;

    if (options.messages) {
      messages = [];
      for (const msg of options.messages) {
        if (msg.role === 'system') {
          system = typeof msg.content === 'string' ? msg.content : (msg.content[0] as { text: string }).text;
          continue;
        }
        messages.push({
          role: msg.role,
          content: typeof msg.content === 'string'
            ? msg.content
            : this.mapContentParts(msg.content),
        });
      }
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: options.maxTokens ?? 1024,
          system,
          messages,
          temperature: options.temperature ?? 0.7,
          stop_sequences: options.stopSequences,
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Anthropic API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
      stop_reason: string;
    };

    const textContent = data.content.find(c => c.type === 'text');
    const usage = {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    };

    return {
      content: textContent?.text ?? '',
      usage,
      model: data.model,
      finishReason: this.mapStopReason(data.stop_reason),
      cost: calcAnthropicCost(data.model, usage.promptTokens, usage.completionTokens),
    };
  }

  async embed(_texts: string | string[]): Promise<number[][]> {
    throw new Error('Anthropic does not provide embedding models. Use OpenAI or another provider for embeddings.');
  }

  private mapContentParts(parts: ContentPart[]): unknown[] {
    return parts.map(part => {
      switch (part.type) {
        case 'text':
          return { type: 'text', text: part.text };
        case 'image_url':
          return {
            type: 'image',
            source: { type: 'url', url: part.image_url.url },
          };
        case 'image_base64':
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: part.mimeType,
              data: part.data,
            },
          };
        case 'audio':
          return {
            type: 'input_audio',
            source: { data: part.data, format: part.format },
          };
        default:
          return { type: 'text', text: JSON.stringify(part) };
      }
    });
  }

  private mapStopReason(reason: string): LLMResult['finishReason'] {
    switch (reason) {
      case 'end_turn': return 'stop';
      case 'max_tokens': return 'length';
      case 'tool_use': return 'tool_calls';
      default: return 'stop';
    }
  }

  /**
   * Stream generation - returns an AsyncIterable of stream events
   */
  async *stream(prompt: string, options: StreamGenerateOptions = {}): AsyncIterable<LLMStreamEvent> {
    let messages: Array<{ role: string; content: string | unknown[] }>;
    let system = options.systemPrompt;

    if (options.messages) {
      messages = [];
      for (const msg of options.messages) {
        if (msg.role === 'system') {
          system = typeof msg.content === 'string' ? msg.content : String(msg.content);
          continue;
        }
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/v1/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: options.maxTokens ?? 1024,
          system,
          messages,
          temperature: options.temperature ?? 0.7,
          stop_sequences: options.stopSequences,
          stream: true,
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        yield createStreamEvent<OrkaErrorEvent>('error', {
          error: new Error(`Anthropic API request timed out after ${this.timeoutMs}ms`),
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
        error: new Error(`Anthropic API error: ${response.status} - ${errorText}`),
        message: `Anthropic API error: ${response.status}`,
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
    let _thinking = '';
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const eventType = json.type;

            switch (eventType) {
              case 'message_start':
                if (json.message?.usage) {
                  usage.promptTokens = json.message.usage.input_tokens || 0;
                }
                break;

              case 'content_block_start':
                // Handle thinking blocks (Claude extended thinking)
                if (json.content_block?.type === 'thinking') {
                  _thinking = '';
                }
                break;

              case 'content_block_delta':
                if (json.delta?.type === 'thinking_delta') {
                  // Extended thinking content
                  const thinkingDelta = json.delta.thinking || '';
                  _thinking += thinkingDelta;
                  yield createStreamEvent<ThinkingEvent>('thinking', {
                    thinking: _thinking,
                    delta: thinkingDelta,
                  });
                } else if (json.delta?.type === 'text_delta') {
                  // Regular text content
                  const token = json.delta.text || '';
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
                break;

              case 'message_delta':
                if (json.delta?.stop_reason) {
                  finishReason = this.mapStopReason(json.delta.stop_reason);
                }
                if (json.usage) {
                  usage.completionTokens = json.usage.output_tokens || 0;
                  usage.totalTokens = usage.promptTokens + usage.completionTokens;
                  yield createStreamEvent<UsageEvent>('usage', { usage });
                }
                break;

              case 'message_stop':
                // Stream complete
                break;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Emit done event
      const cost = calcAnthropicCost(this.model, usage.promptTokens, usage.completionTokens);
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
