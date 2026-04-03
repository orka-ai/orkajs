import type {
  LLMAdapter,
  LLMGenerateOptions,
  LLMResult,
  ContentPart,
  OrkaSchema,
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

export interface GoogleAdapterConfig {
  apiKey: string;
  model?: string;
  embeddingModel?: string;
  baseURL?: string;
  timeoutMs?: number;
}

export class GoogleAdapter implements LLMAdapter, StreamingLLMAdapter {
  readonly name = 'google';
  readonly supportsStreaming = true;
  private apiKey: string;
  private model: string;
  private embeddingModel: string;
  private baseURL: string;
  private timeoutMs: number;

  constructor(config: GoogleAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gemini-1.5-flash';
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-004';
    this.baseURL = config.baseURL ?? 'https://generativelanguage.googleapis.com/v1beta';
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const contents = this.buildContents(prompt, options);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(
        `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens ?? 1024,
              stopSequences: options.stopSequences,
            },
            systemInstruction: options.systemPrompt
              ? { parts: [{ text: options.systemPrompt }] }
              : undefined,
          }),
        }
      );
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Google AI API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google AI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
        finishReason: string;
      }>;
      usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      };
    };

    const content = data.candidates[0]?.content?.parts
      ?.map(p => p.text)
      .join('') ?? '';

    return {
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      },
      model: this.model,
      finishReason: this.mapFinishReason(data.candidates[0]?.finishReason),
    };
  }

  async generateObject<T>(schema: OrkaSchema<T>, prompt: string, options?: LLMGenerateOptions): Promise<T> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (options?.messages) {
      for (const msg of options.messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
          });
        }
      }
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const generationConfig: Record<string, unknown> = {
      temperature: options?.temperature ?? 0,
      responseMimeType: 'application/json',
    };

    if (schema.jsonSchema) {
      generationConfig.responseSchema = schema.jsonSchema;
    }

    if (options?.maxTokens) generationConfig.maxOutputTokens = options.maxTokens;

    const body: Record<string, unknown> = {
      contents,
      generationConfig,
    };

    if (options?.systemPrompt) {
      body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
    }

    const response = await fetch(
      `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`Google generateObject error: ${err.error?.message ?? response.statusText}`);
    }

    const data = await response.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>
    };
    const content = data.candidates[0]?.content?.parts[0]?.text ?? '{}';

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Google returned invalid JSON: ${content.slice(0, 200)}`);
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Schema validation failed: ${JSON.stringify((result as { error: unknown }).error)}`);
    }
    return (result as { success: true; data: T }).data;
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    const input = Array.isArray(texts) ? texts : [texts];
    const embeddings: number[][] = [];

    for (const text of input) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      let response: Response;
      try {
        response = await fetch(
          `${this.baseURL}/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: `models/${this.embeddingModel}`,
              content: { parts: [{ text }] },
            }),
          }
        );
      } catch (error) {
        clearTimeout(timeout);
        if ((error as Error).name === 'AbortError') {
          throw new Error(`Google AI Embeddings API request timed out after ${this.timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google AI Embeddings API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        embedding: { values: number[] };
      };

      embeddings.push(data.embedding.values);
    }

    return embeddings;
  }

  async *stream(prompt: string, options: StreamGenerateOptions = {}): AsyncIterable<LLMStreamEvent> {
    const contents = this.buildContents(prompt, options as LLMGenerateOptions);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    let response: Response;
    try {
      response = await fetch(
        `${this.baseURL}/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens ?? 1024,
              stopSequences: options.stopSequences,
            },
            systemInstruction: options.systemPrompt
              ? { parts: [{ text: options.systemPrompt }] }
              : undefined,
          }),
        }
      );
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        yield createStreamEvent<OrkaErrorEvent>('error', {
          error: new Error(`Google AI API request timed out after ${this.timeoutMs}ms`),
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
        error: new Error(`Google AI API error: ${response.status} - ${errorText}`),
        message: `Google AI API error: ${response.status}`,
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));

            if (json.usageMetadata) {
              usage = {
                promptTokens: json.usageMetadata.promptTokenCount ?? 0,
                completionTokens: json.usageMetadata.candidatesTokenCount ?? 0,
                totalTokens: json.usageMetadata.totalTokenCount ?? 0,
              };
              yield createStreamEvent<UsageEvent>('usage', { usage });
            }

            const candidate = json.candidates?.[0];
            if (!candidate) continue;

            if (candidate.finishReason) {
              finishReason = this.mapFinishReason(candidate.finishReason);
            }

            const parts = candidate.content?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.text) {
                  const token = part.text;
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

  private buildContents(prompt: string, options: LLMGenerateOptions): Array<{ role: string; parts: unknown[] }> {
    const contents: Array<{ role: string; parts: unknown[] }> = [];

    if (options.messages) {
      for (const msg of options.messages) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const parts = typeof msg.content === 'string'
          ? [{ text: msg.content }]
          : this.mapContentParts(msg.content);
        contents.push({ role, parts });
      }
    } else {
      contents.push({ role: 'user', parts: [{ text: prompt }] });
    }

    return contents;
  }

  private mapContentParts(parts: ContentPart[]): unknown[] {
    return parts.map(part => {
      switch (part.type) {
        case 'text':
          return { text: part.text };
        case 'image_url':
          return {
            inlineData: {
              mimeType: 'image/jpeg',
              data: part.image_url.url,
            },
          };
        case 'image_base64':
          return {
            inlineData: {
              mimeType: part.mimeType,
              data: part.data,
            },
          };
        default:
          return { text: JSON.stringify(part) };
      }
    });
  }

  private mapFinishReason(reason: string): LLMResult['finishReason'] {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
      case 'OTHER':
        return 'stop';
      default:
        return 'stop';
    }
  }
}
