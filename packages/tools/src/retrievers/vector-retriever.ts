import type { VectorSearchResult, LLMAdapter, VectorDBAdapter } from '@orkajs/core';
import type { Retriever } from './types.js';

export interface VectorRetrieverOptions {
  llm: LLMAdapter;
  vectorDB: VectorDBAdapter;
  topK?: number;
  minScore?: number;
}

export class VectorRetriever implements Retriever {
  private llm: LLMAdapter;
  private vectorDB: VectorDBAdapter;
  private topK: number;
  private minScore?: number;

  constructor(options: VectorRetrieverOptions) {
    this.llm = options.llm;
    this.vectorDB = options.vectorDB;
    this.topK = options.topK ?? 5;
    this.minScore = options.minScore;
  }

  async retrieve(query: string, collection: string): Promise<VectorSearchResult[]> {
    const [embedding] = await this.llm.embed([query]);
    return this.vectorDB.search(collection, embedding, {
      topK: this.topK,
      minScore: this.minScore,
    });
  }
}
