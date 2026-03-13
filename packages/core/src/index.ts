// Types
export type {
  LLMAdapter,
  LLMGenerateOptions,
  LLMResult,
  VectorDBAdapter,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
  CreateCollectionOptions,
  DatabaseAdapter,
  OrkaConfig,
  OrkaDefaults,
  KnowledgeCreateOptions,
  KnowledgeSource,
  AskOptions,
  AskResult,
  RetrievedContext,
  Document,
  Chunk,
  ChatMessage,
  ContentPart,
} from './types.js';

// Errors
export { OrkaError, OrkaErrorCode } from './errors.js';

// Utils
export { generateId } from './utils.js';

// Chunker
export { chunkDocument, chunkDocuments, type ChunkerOptions } from './chunker.js';

// Knowledge
export { Knowledge } from './knowledge.js';

// Orka main class
export { Orka, createOrka, type StreamAskOptions, type StreamAskResult } from './orka.js';

// PII Guard
export {
  PIIGuard,
  createPIIGuard,
  redactPII,
  detectPII,
  type PIIType,
  type PIIMatch,
  type PIIDetectionResult,
  type PIIGuardConfig,
  type CustomPIIPattern,
} from './guard.js';

// Streaming
export {
  isStreamingAdapter,
  createStreamEvent,
  consumeStream,
  parseSSEStream,
  type StreamEventType,
  type StreamEvent,
  type TokenEvent,
  type ContentEvent,
  type ToolCallEvent,
  type ToolResultEvent,
  type ThinkingEvent,
  type UsageEvent,
  type DoneEvent,
  type ErrorEvent,
  type LLMStreamEvent,
  type StreamEventHandler,
  type TokenHandler,
  type StreamGenerateOptions,
  type StreamResult,
  type StreamingLLMAdapter,
} from './streaming.js';
