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
  ToolCallEvent,
  UsageEvent,
  DoneEvent,
  ErrorEvent as OrkaErrorEvent,
} from '@orka-js/core';
import { createStreamEvent } from '@orka-js/core';

export interface OpenAIAdapterConfig {
  apiKey: string;
  model?: string;
  embeddingModel?: string;
  baseURL?: string;
  timeoutMs?: number;
}

export class OpenAIAdapter implements LLMAdapter, StreamingLLMAdapter {
  readonly name = 'openai';
  readonly supportsStreaming = true;
  private apiKey: string;
  private model: string;
  private embeddingModel: string;
  private baseURL: string;
  private timeoutMs: number;

  constructor(config: OpenAIAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gpt-4o-mini';
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-3-small';
    this.baseURL = config.baseURL ?? 'https://api.openai.com/v1';
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const messages: Array<{ role: string; content: string | unknown[] }> = [];

    if (options.messages) {
      for (const msg of options.messages) {
        messages.push({
          role: msg.role,
          content: typeof msg.content === 'string'
            ? msg.content
            : this.mapContentParts(msg.content),
        });
      }
    } else {
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });
    }

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
        throw new Error(`OpenAI API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
      finishReason: this.mapFinishReason(data.choices[0]?.finish_reason),
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
        throw new Error(`OpenAI Embeddings API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embeddings API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return data.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);
  }

  private mapContentParts(parts: ContentPart[]): unknown[] {
    return parts.map(part => {
      switch (part.type) {
        case 'text':
          return { type: 'text', text: part.text };
        case 'image_url':
          return { type: 'image_url', image_url: part.image_url };
        case 'image_base64':
          return {
            type: 'image_url',
            image_url: { url: `data:${part.mimeType};base64,${part.data}` },
          };
        case 'audio':
          return {
            type: 'input_audio',
            input_audio: { data: part.data, format: part.format },
          };
        default:
          return part;
      }
    });
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
   */
  async *stream(prompt: string, options: StreamGenerateOptions = {}): AsyncIterable<LLMStreamEvent> {
    const messages: Array<{ role: string; content: string | unknown[] }> = [];

    if (options.messages) {
      for (const msg of options.messages) {
        messages.push({
          role: msg.role,
          content: typeof msg.content === 'string'
            ? msg.content
            : msg.content,
        });
      }
    } else {
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    // Combine with external signal if provided
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
          stream_options: { include_usage: true },
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        yield createStreamEvent<OrkaErrorEvent>('error', {
          error: new Error(`OpenAI API request timed out after ${this.timeoutMs}ms`),
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
        error: new Error(`OpenAI API error: ${response.status} - ${errorText}`),
        message: `OpenAI API error: ${response.status}`,
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
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            
            // Handle usage info (comes at the end with stream_options)
            if (json.usage) {
              usage = {
                promptTokens: json.usage.prompt_tokens,
                completionTokens: json.usage.completion_tokens,
                totalTokens: json.usage.total_tokens,
              };
              yield createStreamEvent<UsageEvent>('usage', { usage });
            }

            const choice = json.choices?.[0];
            if (!choice) continue;

            // Handle finish reason
            if (choice.finish_reason) {
              finishReason = this.mapFinishReason(choice.finish_reason);
            }

            // Handle content delta
            const delta = choice.delta;
            if (delta?.content) {
              const token = delta.content;
              content += token;
              
              // Emit token event
              yield createStreamEvent<TokenEvent>('token', {
                token,
                index: tokenIndex++,
              });

              // Call onToken callback if provided
              options.onToken?.(token, tokenIndex - 1);

              // Emit content event
              yield createStreamEvent<ContentEvent>('content', {
                content,
                delta: token,
                index: tokenIndex - 1,
              });
            }

            // Handle tool calls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (toolCall.function) {
                  yield createStreamEvent<ToolCallEvent>('tool_call', {
                    toolCallId: toolCall.id || '',
                    name: toolCall.function.name || '',
                    arguments: toolCall.function.arguments || '',
                  });
                }
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Emit done event
      yield createStreamEvent<DoneEvent>('done', {
        content,
        finishReason,
        usage,
      });

      // Call onEvent callback for done
      options.onEvent?.(createStreamEvent<DoneEvent>('done', {
        content,
        finishReason,
        usage,
      }));

    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Stream generation with final result - convenience method
   */
  async streamGenerate(prompt: string, options: StreamGenerateOptions = {}): Promise<StreamResult> {
    const startTime = Date.now();
    let content = '';
    let tokenIndex = 0;
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let finishReason: StreamResult['finishReason'] = 'stop';
    let ttft: number | undefined;

    for await (const event of this.stream(prompt, options)) {
      // Call event handler
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
}
