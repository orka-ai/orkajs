import type { LLMAdapter, LLMGenerateOptions, LLMResult, ContentPart } from '@orkajs/core';

export interface AnthropicAdapterConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  timeoutMs?: number;
}

export class AnthropicAdapter implements LLMAdapter {
  readonly name = 'anthropic';
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

    return {
      content: textContent?.text ?? '',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
      finishReason: this.mapStopReason(data.stop_reason),
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
}
