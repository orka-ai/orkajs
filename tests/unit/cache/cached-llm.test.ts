import { describe, it, expect, vi } from 'vitest';
import { CachedLLM, MemoryCache } from '@orka-js/cache';
import type { LLMAdapter, LLMResult } from '@orka-js/core';

const mockResult = (content = 'cached response'): LLMResult => ({
  content,
  usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
  model: 'mock',
  finishReason: 'stop',
});

const createMockLLM = (name = 'mock'): LLMAdapter => ({
  name,
  generate: vi.fn().mockResolvedValue(mockResult()),
  embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
});

describe('CachedLLM', () => {
  describe('generate()', () => {
    it('calls inner LLM on cache miss and returns result', async () => {
      const inner = createMockLLM();
      const cache = new MemoryCache();
      const llm = new CachedLLM(inner, cache);
      const result = await llm.generate('Hello');
      expect(inner.generate).toHaveBeenCalledTimes(1);
      expect(result.content).toBe('cached response');
    });

    it('returns cached result on second call without calling inner LLM', async () => {
      const inner = createMockLLM();
      const cache = new MemoryCache();
      const llm = new CachedLLM(inner, cache);
      await llm.generate('Hello');
      const result = await llm.generate('Hello');
      expect(inner.generate).toHaveBeenCalledTimes(1);
      expect(result.content).toBe('cached response');
    });

    it('uses different cache keys for different prompts', async () => {
      const inner = createMockLLM();
      const cache = new MemoryCache();
      const llm = new CachedLLM(inner, cache);
      await llm.generate('Hello');
      await llm.generate('Goodbye');
      expect(inner.generate).toHaveBeenCalledTimes(2);
    });

    it('uses different cache keys for different options', async () => {
      const inner = createMockLLM();
      const cache = new MemoryCache();
      const llm = new CachedLLM(inner, cache);
      await llm.generate('Hello', { temperature: 0.5 });
      await llm.generate('Hello', { temperature: 0.9 });
      expect(inner.generate).toHaveBeenCalledTimes(2);
    });

    it('uses same cache key for identical prompt and options', async () => {
      const inner = createMockLLM();
      const cache = new MemoryCache();
      const llm = new CachedLLM(inner, cache);
      await llm.generate('Hello', { temperature: 0.7 });
      await llm.generate('Hello', { temperature: 0.7 });
      expect(inner.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe('embed()', () => {
    it('always delegates to inner LLM without caching', async () => {
      const inner = createMockLLM();
      const cache = new MemoryCache();
      const llm = new CachedLLM(inner, cache);
      await llm.embed('text');
      await llm.embed('text');
      expect(inner.embed).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCache()', () => {
    it('invalidates cached entries', async () => {
      const inner = createMockLLM();
      const cache = new MemoryCache();
      const llm = new CachedLLM(inner, cache);
      await llm.generate('Hello');
      await llm.clearCache();
      await llm.generate('Hello');
      expect(inner.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('name', () => {
    it('is "cached-{innerName}"', () => {
      const inner = createMockLLM('gpt-4');
      const cache = new MemoryCache();
      const llm = new CachedLLM(inner, cache);
      expect(llm.name).toBe('cached-gpt-4');
    });
  });

  describe('getInnerLLM()', () => {
    it('returns the wrapped adapter', () => {
      const inner = createMockLLM();
      const cache = new MemoryCache();
      const llm = new CachedLLM(inner, cache);
      expect(llm.getInnerLLM()).toBe(inner);
    });
  });

  describe('custom hashFn', () => {
    it('uses the provided hash function for cache keys', async () => {
      const inner = createMockLLM();
      const cache = new MemoryCache();
      const hashFn = vi.fn().mockReturnValue('custom-key');
      const llm = new CachedLLM(inner, cache, { hashFn });
      await llm.generate('Hello');
      await llm.generate('Goodbye'); // different prompt, same hash
      expect(hashFn).toHaveBeenCalledTimes(2);
      expect(inner.generate).toHaveBeenCalledTimes(1); // same cache key = hit
    });
  });
});
