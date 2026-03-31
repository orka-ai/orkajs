export interface LLMAdapter {
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult>;
  embed(text: string | string[]): Promise<number[][]>;
  readonly name: string;
}

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'image_base64'; data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }
  | { type: 'audio'; data: string; format: 'wav' | 'mp3' };

export interface LLMResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  /** Estimated cost in USD, calculated by the adapter when pricing data is available */
  cost?: number;
}

export interface VectorDBAdapter {
  upsert(collection: string, vectors: VectorRecord[]): Promise<void>;
  search(collection: string, vector: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>;
  delete(collection: string, ids: string[]): Promise<void>;
  createCollection(name: string, options?: CreateCollectionOptions): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  readonly name: string;
}

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  content?: string;
}

export interface VectorSearchOptions {
  topK?: number;
  filter?: Record<string, unknown>;
  minScore?: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
  content?: string;
}

export interface CreateCollectionOptions {
  dimension?: number;
  metric?: 'cosine' | 'euclidean' | 'dotProduct';
}

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }>;
  readonly name: string;
}

export interface OrkaConfig {
  llm: LLMAdapter;
  vectorDB?: VectorDBAdapter;
  database?: DatabaseAdapter;
  defaults?: OrkaDefaults;
}

export interface OrkaDefaults {
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface KnowledgeCreateOptions {
  name: string;
  source: KnowledgeSource;
  chunkSize?: number;
  chunkOverlap?: number;
  metadata?: Record<string, unknown>;
}

export type KnowledgeSource = 
  | string 
  | string[] 
  | { text: string; metadata?: Record<string, unknown> }[]
  | { path: string }
  | { url: string };

export interface ZodLikeSchema<T = unknown> {
  parse(data: unknown): T;
  safeParse(data: unknown): {
    success: boolean;
    data?: T;
    error?: {
      message: string;
      issues?: Array<{ path: (string | number)[]; message: string }>;
    };
  };
  shape?: Record<string, unknown>;
  description?: string;
}

export interface AskOptions {
  knowledge?: string;
  question: string;
  systemPrompt?: string;
  topK?: number;
  temperature?: number;
  maxTokens?: number;
  includeContext?: boolean;
  schema?: ZodLikeSchema<unknown>;
}

export interface AskResult<T = string> {
  answer: T;
  context?: RetrievedContext[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost?: number;
  };
  latencyMs: number;
}

export interface RetrievedContext {
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Chunk {
  id: string;
  content: string;
  documentId: string;
  index: number;
  metadata?: Record<string, unknown>;
}
