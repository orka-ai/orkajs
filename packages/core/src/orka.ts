import type {
  LLMAdapter,
  VectorDBAdapter,
  OrkaConfig,
  OrkaDefaults,
  AskOptions,
  AskResult,
  RetrievedContext,
  ZodLikeSchema,
} from './types.js';
import { OrkaError, OrkaErrorCode } from './errors.js';
import type {
  StreamingLLMAdapter,
  StreamGenerateOptions,
  LLMStreamEvent,
  TokenEvent,
  ContentEvent,
  DoneEvent,
  ErrorEvent,
} from './streaming.js';
import { Knowledge } from './knowledge.js';
import { isStreamingAdapter, createStreamEvent } from './streaming.js';

export interface StreamAskOptions extends AskOptions {
  onToken?: (token: string, index: number) => void;
  onEvent?: (event: LLMStreamEvent) => void;
  signal?: AbortSignal;
}

export interface StreamAskResult extends AskResult {
  ttft?: number;
  durationMs: number;
}

export class Orka {
  private llm: LLMAdapter;
  private vectorDB?: VectorDBAdapter;
  private defaults: OrkaDefaults;
  readonly knowledge: Knowledge;

  constructor(config: OrkaConfig) {
    this.llm = config.llm;
    this.vectorDB = config.vectorDB;
    this.defaults = config.defaults ?? {};

    if (this.vectorDB) {
      this.knowledge = new Knowledge(this.llm, this.vectorDB, this.defaults);
    } else {
      this.knowledge = new Knowledge(this.llm, {
        name: 'memory',
        upsert: async () => {},
        search: async () => [],
        delete: async () => {},
        createCollection: async () => {},
        deleteCollection: async () => {},
      }, this.defaults);
    }
  }

  async ask(options: AskOptions & { schema?: undefined }): Promise<AskResult<string>>;
  async ask<T>(options: AskOptions & { schema: ZodLikeSchema<T> }): Promise<AskResult<T>>;
  async ask<T = string>(options: AskOptions & { schema?: ZodLikeSchema<T> }): Promise<AskResult<T>> {
    const startTime = Date.now();
    const {
      knowledge,
      question,
      topK = this.defaults.topK ?? 5,
      temperature = this.defaults.temperature ?? 0.7,
      maxTokens = this.defaults.maxTokens ?? 1024,
      includeContext = false,
      schema,
    } = options;

    const systemPrompt = schema
      ? `${options.systemPrompt ?? ''}\n\nRespond with valid JSON only. No text before or after the JSON.`.trim()
      : options.systemPrompt;

    let context: RetrievedContext[] = [];
    let prompt = question;

    if (knowledge && this.vectorDB) {
      const results = await this.knowledge.search(knowledge, question, { topK });
      context = results.map(r => ({
        content: r.content ?? '',
        score: r.score,
        metadata: r.metadata,
      }));

      if (context.length > 0) {
        const contextText = context.map(c => c.content).join('\n\n---\n\n');
        prompt = `Context:\n${contextText}\n\nQuestion: ${question}\n\nAnswer based on the context provided:`;
      }
    }

    const result = await this.llm.generate(prompt, {
      systemPrompt,
      temperature,
      maxTokens,
    });

    const answer = schema
      ? this.parseAndValidate<T>(result.content, schema)
      : result.content as unknown as T;

    return {
      answer,
      context: includeContext ? context : undefined,
      usage: result.usage,
      latencyMs: Date.now() - startTime,
    };
  }

  async *streamAsk(options: StreamAskOptions): AsyncIterable<LLMStreamEvent> {
    const {
      knowledge,
      question,
      systemPrompt,
      topK = this.defaults.topK ?? 5,
      temperature = this.defaults.temperature ?? 0.7,
      maxTokens = this.defaults.maxTokens ?? 1024,
      onToken,
      onEvent,
      signal,
    } = options;

    if (!isStreamingAdapter(this.llm)) {
      yield createStreamEvent<ErrorEvent>('error', {
        error: new Error('LLM adapter does not support streaming'),
        message: 'LLM adapter does not support streaming',
      });
      return;
    }

    const streamingLLM = this.llm as StreamingLLMAdapter;
    let prompt = question;

    if (knowledge && this.vectorDB) {
      const results = await this.knowledge.search(knowledge, question, { topK });
      const context = results.map(r => r.content ?? '');

      if (context.length > 0) {
        const contextText = context.join('\n\n---\n\n');
        prompt = `Context:\n${contextText}\n\nQuestion: ${question}\n\nAnswer based on the context provided:`;
      }
    }

    const streamOptions: StreamGenerateOptions = {
      systemPrompt,
      temperature,
      maxTokens,
      onToken,
      onEvent,
      signal,
    };

    for await (const event of streamingLLM.stream(prompt, streamOptions)) {
      yield event;
    }
  }

  async streamAskComplete(options: StreamAskOptions): Promise<StreamAskResult> {
    const startTime = Date.now();
    const {
      knowledge,
      question,
      systemPrompt,
      topK = this.defaults.topK ?? 5,
      temperature = this.defaults.temperature ?? 0.7,
      maxTokens = this.defaults.maxTokens ?? 1024,
      includeContext = false,
      onToken,
      onEvent,
      signal,
    } = options;

    let context: RetrievedContext[] = [];
    let prompt = question;

    if (knowledge && this.vectorDB) {
      const results = await this.knowledge.search(knowledge, question, { topK });
      context = results.map(r => ({
        content: r.content ?? '',
        score: r.score,
        metadata: r.metadata,
      }));

      if (context.length > 0) {
        const contextText = context.map(c => c.content).join('\n\n---\n\n');
        prompt = `Context:\n${contextText}\n\nQuestion: ${question}\n\nAnswer based on the context provided:`;
      }
    }

    if (!isStreamingAdapter(this.llm)) {
      const result = await this.llm.generate(prompt, {
        systemPrompt,
        temperature,
        maxTokens,
      });

      return {
        answer: result.content,
        context: includeContext ? context : undefined,
        usage: result.usage,
        latencyMs: Date.now() - startTime,
        durationMs: Date.now() - startTime,
      };
    }

    const streamingLLM = this.llm as StreamingLLMAdapter;
    let content = '';
    let tokenIndex = 0;
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let ttft: number | undefined;

    for await (const event of streamingLLM.stream(prompt, {
      systemPrompt,
      temperature,
      maxTokens,
      signal,
    })) {
      onEvent?.(event);

      switch (event.type) {
        case 'token':
          if (ttft === undefined) ttft = Date.now() - startTime;
          content += (event as TokenEvent).token;
          onToken?.((event as TokenEvent).token, tokenIndex++);
          break;
        case 'content':
          content = (event as ContentEvent).content;
          break;
        case 'usage':
          usage = event.usage;
          break;
        case 'done':
          content = (event as DoneEvent).content;
          if ((event as DoneEvent).usage) usage = (event as DoneEvent).usage!;
          break;
        case 'error':
          throw (event as ErrorEvent).error;
      }
    }

    return {
      answer: content,
      context: includeContext ? context : undefined,
      usage,
      latencyMs: Date.now() - startTime,
      ttft,
      durationMs: Date.now() - startTime,
    };
  }

  async generate(prompt: string, options?: { temperature?: number; maxTokens?: number; systemPrompt?: string }): Promise<string>;
  async generate<T>(prompt: string, options: { temperature?: number; maxTokens?: number; systemPrompt?: string; schema: ZodLikeSchema<T> }): Promise<T>;
  async generate<T = string>(prompt: string, options?: { temperature?: number; maxTokens?: number; systemPrompt?: string; schema?: ZodLikeSchema<T> }): Promise<string | T> {
    const { schema, ...llmOptions } = options ?? {};
    const systemPrompt = schema
      ? `${llmOptions.systemPrompt ?? ''}\n\nRespond with valid JSON only. No text before or after the JSON.`.trim()
      : llmOptions.systemPrompt;

    const result = await this.llm.generate(prompt, {
      temperature: llmOptions.temperature ?? this.defaults.temperature ?? 0.7,
      maxTokens: llmOptions.maxTokens ?? this.defaults.maxTokens ?? 1024,
      systemPrompt,
    });

    if (schema) return this.parseAndValidate<T>(result.content, schema);
    return result.content;
  }

  private extractJSON(content: string): string {
    const codeBlock = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlock) return codeBlock[1].trim();
    const obj = content.match(/\{[\s\S]*\}/);
    if (obj) return obj[0];
    return content.trim();
  }

  private parseAndValidate<T>(content: string, schema: ZodLikeSchema<T>): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.extractJSON(content));
    } catch (e) {
      throw new OrkaError(
        `Failed to parse JSON from LLM response: ${(e as Error).message}`,
        OrkaErrorCode.PARSE_ERROR,
        'core/orka',
      );
    }
    const r = schema.safeParse(parsed);
    if (!r.success) {
      const detail = r.error?.issues?.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') ?? r.error?.message ?? 'unknown';
      throw new OrkaError(
        `Schema validation failed: ${detail}`,
        OrkaErrorCode.VALIDATION_ERROR,
        'core/orka',
      );
    }
    return r.data!;
  }

  async *stream(prompt: string, options?: StreamGenerateOptions): AsyncIterable<LLMStreamEvent> {
    if (!isStreamingAdapter(this.llm)) {
      yield createStreamEvent<ErrorEvent>('error', {
        error: new Error('LLM adapter does not support streaming'),
        message: 'LLM adapter does not support streaming',
      });
      return;
    }

    const streamingLLM = this.llm as StreamingLLMAdapter;
    for await (const event of streamingLLM.stream(prompt, options ?? {})) {
      yield event;
    }
  }
}

export function createOrka(config: OrkaConfig): Orka {
  return new Orka(config);
}
