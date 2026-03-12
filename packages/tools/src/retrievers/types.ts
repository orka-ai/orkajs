import type { VectorSearchResult, LLMAdapter, VectorDBAdapter } from '@orka-js/core';

export interface Retriever {
  retrieve(query: string, collection: string): Promise<VectorSearchResult[]>;
}

export interface MultiQueryRetrieverOptions {
  llm: LLMAdapter;
  vectorDB: VectorDBAdapter;
  queryCount?: number;
  topK?: number;
  minScore?: number;
  deduplicateByContent?: boolean;
}

export interface ContextualCompressionRetrieverOptions {
  llm: LLMAdapter;
  vectorDB: VectorDBAdapter;
  topK?: number;
  minScore?: number;
  maxCompressedLength?: number;
}

export interface EnsembleRetrieverOptions {
  retrievers: Retriever[];
  weights?: number[];
  topK?: number;
}

export interface ParentDocumentRetrieverOptions {
  vectorDB: VectorDBAdapter;
  llm: LLMAdapter;
  childTopK?: number;
  parentTopK?: number;
  minScore?: number;
}

export interface SelfQueryRetrieverOptions {
  llm: LLMAdapter;
  vectorDB: VectorDBAdapter;
  metadataFields: MetadataFieldInfo[];
  topK?: number;
  minScore?: number;
}

export interface MetadataFieldInfo {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description: string;
  enumValues?: string[];
}
