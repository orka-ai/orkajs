import type { LLMAdapter, LLMGenerateOptions, LLMResult, OrkaSchema } from '@orka-js/core';
import type { CacheStore, LLMCacheOptions } from './types.js';

export class CachedLLM implements LLMAdapter {
  readonly name: string;
  private llm: LLMAdapter;
  private cache: CacheStore;
  private ttlMs?: number;
  private hashFn: (prompt: string, options?: Record<string, unknown>) => string;

  constructor(llm: LLMAdapter, cache: CacheStore, options: LLMCacheOptions = {}) {
    this.llm = llm;
    this.cache = cache;
    this.name = `cached-${llm.name}`;
    this.ttlMs = options.ttlMs;
    this.hashFn = options.hashFn ?? this.defaultHash;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const cacheKey = `llm:${this.hashFn(prompt, options as Record<string, unknown>)}`;

    const cached = await this.cache.get<LLMResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.llm.generate(prompt, options);
    await this.cache.set(cacheKey, result, this.ttlMs);

    return result;
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    return this.llm.embed(texts);
  }

  async generateObject<T>(schema: OrkaSchema<T>, prompt: string, options?: LLMGenerateOptions): Promise<T> {
    return this.llm.generateObject(schema, prompt, options);
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  getInnerLLM(): LLMAdapter {
    return this.llm;
  }

  private defaultHash(prompt: string, options?: Record<string, unknown>): string {
    const input = JSON.stringify({ prompt, options });
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(36).padStart(8, '0');
  }
}
