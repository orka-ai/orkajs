/**
 * Streaming types and utilities for OrkaJS
 * Enables real-time token streaming from LLM providers
 */

/**
 * Event types emitted during streaming
 */
export type StreamEventType =
  | 'token'           // Individual token received
  | 'content'         // Content chunk (may contain multiple tokens)
  | 'tool_call'       // Tool/function call started
  | 'tool_result'     // Tool/function result received
  | 'thinking'        // Model thinking/reasoning (Claude)
  | 'usage'           // Token usage update
  | 'done'            // Stream completed
  | 'error';          // Error occurred

/**
 * Base stream event
 */
export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
}

/**
 * Token event - single token received
 */
export interface TokenEvent extends StreamEvent {
  type: 'token';
  token: string;
  index: number;
}

/**
 * Content event - content chunk (may be multiple tokens)
 */
export interface ContentEvent extends StreamEvent {
  type: 'content';
  content: string;
  delta: string;
  index: number;
}

/**
 * Tool call event - function/tool invocation started
 */
export interface ToolCallEvent extends StreamEvent {
  type: 'tool_call';
  toolCallId: string;
  name: string;
  arguments: string;
}

/**
 * Tool result event - function/tool result received
 */
export interface ToolResultEvent extends StreamEvent {
  type: 'tool_result';
  toolCallId: string;
  result: unknown;
}

/**
 * Thinking event - model reasoning (Claude extended thinking)
 */
export interface ThinkingEvent extends StreamEvent {
  type: 'thinking';
  thinking: string;
  delta: string;
}

/**
 * Usage event - token usage update
 */
export interface UsageEvent extends StreamEvent {
  type: 'usage';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Done event - stream completed
 */
export interface DoneEvent extends StreamEvent {
  type: 'done';
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Estimated cost in USD for this generation */
  cost?: number;
}

/**
 * Error event - error occurred during streaming
 */
export interface ErrorEvent extends StreamEvent {
  type: 'error';
  error: Error;
  message: string;
}

/**
 * Union of all stream events
 */
export type LLMStreamEvent =
  | TokenEvent
  | ContentEvent
  | ToolCallEvent
  | ToolResultEvent
  | ThinkingEvent
  | UsageEvent
  | DoneEvent
  | ErrorEvent;

/**
 * Callback for handling stream events
 */
export type StreamEventHandler = (event: LLMStreamEvent) => void;

/**
 * Callback for handling individual tokens
 */
export type TokenHandler = (token: string, index: number) => void;

/**
 * Options for streaming generation
 */
export interface StreamGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  messages?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | unknown[];
  }>;
  /** Callback for each token */
  onToken?: TokenHandler;
  /** Callback for each stream event */
  onEvent?: StreamEventHandler;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result of a streaming generation
 */
export interface StreamResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  /** Time to first token in milliseconds */
  ttft?: number;
  /** Total streaming duration in milliseconds */
  durationMs: number;
  /** Estimated cost in USD for this generation */
  cost?: number;
}

/**
 * Interface for LLM adapters that support streaming
 */
export interface StreamingLLMAdapter {
  /**
   * Generate a response with streaming
   * @param prompt - The prompt to send
   * @param options - Streaming options including callbacks
   * @returns AsyncIterable of stream events
   */
  stream(prompt: string, options?: StreamGenerateOptions): AsyncIterable<LLMStreamEvent>;

  /**
   * Generate a response with streaming, returning final result
   * @param prompt - The prompt to send
   * @param options - Streaming options including callbacks
   * @returns Promise resolving to the final result
   */
  streamGenerate(prompt: string, options?: StreamGenerateOptions): Promise<StreamResult>;

  /**
   * Check if this adapter supports streaming
   */
  readonly supportsStreaming: boolean;
}

/**
 * Type guard to check if an adapter supports streaming
 */
export function isStreamingAdapter(adapter: unknown): adapter is StreamingLLMAdapter {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    'stream' in adapter &&
    'streamGenerate' in adapter &&
    'supportsStreaming' in adapter &&
    (adapter as StreamingLLMAdapter).supportsStreaming === true
  );
}

/**
 * Helper to create a stream event
 */
export function createStreamEvent<T extends LLMStreamEvent>(
  type: T['type'],
  data: Omit<T, 'type' | 'timestamp'>
): T {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as T;
}

/**
 * Async iterator helper for consuming streams
 */
export async function consumeStream(
  stream: AsyncIterable<LLMStreamEvent>,
  handlers?: {
    onToken?: TokenHandler;
    onEvent?: StreamEventHandler;
  }
): Promise<StreamResult> {
  let content = '';
  let tokenIndex = 0;
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let finishReason: StreamResult['finishReason'] = 'stop';
  let model = '';
  const startTime = Date.now();
  let ttft: number | undefined;

  for await (const event of stream) {
    handlers?.onEvent?.(event);

    switch (event.type) {
      case 'token':
        if (ttft === undefined) ttft = Date.now() - startTime;
        content += event.token;
        handlers?.onToken?.(event.token, tokenIndex++);
        break;
      case 'content':
        if (ttft === undefined) ttft = Date.now() - startTime;
        content = event.content;
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
    model,
    finishReason,
    ttft,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Transform a ReadableStream into an AsyncIterable of stream events
 * Used internally by adapters to parse SSE streams
 */
export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  parser: (line: string) => LLMStreamEvent | null
): AsyncIterable<LLMStreamEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        const event = parser(trimmed);
        if (event) yield event;
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const event = parser(buffer.trim());
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
