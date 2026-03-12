import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCache } from '@orkajs/cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  describe('get/set', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');

      expect(result).toBe('value1');
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await cache.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should overwrite existing values', async () => {
      await cache.set('key', 'first');
      await cache.set('key', 'second');
      const result = await cache.get('key');

      expect(result).toBe('second');
    });

    it('should handle complex objects', async () => {
      const obj = { nested: { data: [1, 2, 3] } };
      await cache.set('obj', obj);
      const result = await cache.get<typeof obj>('obj');

      expect(result).toEqual(obj);
    });
  });

  describe('delete', () => {
    it('should remove existing keys', async () => {
      await cache.set('key', 'value');
      await cache.delete('key');
      const result = await cache.get('key');

      expect(result).toBeUndefined();
    });

    it('should not throw for non-existent keys', async () => {
      await expect(cache.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('has', () => {
    it('should return true for existing keys', async () => {
      await cache.set('key', 'value');
      const result = await cache.has('key');

      expect(result).toBe(true);
    });

    it('should return false for non-existent keys', async () => {
      const result = await cache.has('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();

      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
    });
  });

  describe('TTL', () => {
    it('should expire entries after TTL', async () => {
      const shortTtlCache = new MemoryCache({ ttlMs: 50 });
      await shortTtlCache.set('key', 'value');

      expect(await shortTtlCache.get('key')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(await shortTtlCache.get('key')).toBeUndefined();
    });

    it('should respect per-key TTL', async () => {
      await cache.set('key', 'value', 50);

      expect(await cache.get('key')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(await cache.get('key')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should track hits and misses', async () => {
      await cache.set('key', 'value');
      await cache.get('key');
      await cache.get('nonexistent');

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
    });
  });
});
