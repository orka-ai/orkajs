import type { LLMAdapter } from '../types/index.js';
import type { CacheStore, EmbeddingCacheOptions } from './types.js';

export class CachedEmbeddings {
  private llm: LLMAdapter;
  private cache: CacheStore;
  private ttlMs?: number;
  private hashFn: (text: string) => string;

  constructor(llm: LLMAdapter, cache: CacheStore, options: EmbeddingCacheOptions = {}) {
    this.llm = llm;
    this.cache = cache;
    this.ttlMs = options.ttlMs;
    this.hashFn = options.hashFn ?? this.defaultHash;
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    const input = Array.isArray(texts) ? texts : [texts];
    const results: (number[] | null)[] = new Array(input.length).fill(null);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    // Check cache for each text
    for (let i = 0; i < input.length; i++) {
      const cacheKey = `emb:${this.hashFn(input[i])}`;
      const cached = await this.cache.get<number[]>(cacheKey);
      if (cached) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(input[i]);
      }
    }

    // Embed uncached texts in batch
    if (uncachedTexts.length > 0) {
      const embeddings = await this.llm.embed(uncachedTexts);

      for (let j = 0; j < uncachedTexts.length; j++) {
        const idx = uncachedIndices[j];
        results[idx] = embeddings[j];

        // Cache the result
        const cacheKey = `emb:${this.hashFn(uncachedTexts[j])}`;
        await this.cache.set(cacheKey, embeddings[j], this.ttlMs);
      }
    }

    return results as number[][];
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  private defaultHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
