import type { Message } from './memory.js';

/**
 * Base LLM interface for memory-store.
 * Compatible with both simple LLMs (returning string) and full LLMAdapter (returning LLMResult).
 */
export interface BaseLLM {
  generate(prompt: string, options?: unknown): Promise<string | { content: string }>;
}

export interface BaseEmbeddings {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface BaseVectorDB {
  add(vectors: number[][], documents: string[], metadata?: Record<string, unknown>[]): Promise<string[]>;
  search(vector: number[], topK?: number): Promise<MemoryVectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
}

export interface MemoryVectorSearchResult {
  id: string;
  document: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface Entity {
  name: string;
  type: string;
  attributes?: Record<string, unknown>;
}

export interface Relation {
  subject: string;
  predicate: string;
  object: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeTriple {
  subject: Entity;
  predicate: string;
  object: Entity;
  timestamp?: number;
  source?: string;
}

export interface MemorySearchResult {
  messages: Message[];
  score: number;
  context?: string;
}
