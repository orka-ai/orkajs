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
