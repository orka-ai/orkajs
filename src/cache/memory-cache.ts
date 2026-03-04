import type { CacheStore, CacheOptions, CacheEntry, CacheStats } from './types.js';

export class MemoryCache implements CacheStore {
  readonly name = 'memory-cache';
  private store = new Map<string, CacheEntry>();
  private maxSize: number;
  private namespace: string;
  private defaultTtlMs?: number;
  private stats = { hits: 0, misses: 0 };

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.namespace = options.namespace ?? '';
    this.defaultTtlMs = options.ttlMs;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const fullKey = this.resolveKey(key);
    const entry = this.store.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(fullKey);
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    const fullKey = this.resolveKey(key);
    const ttl = ttlMs ?? this.defaultTtlMs;

    if (this.store.size >= this.maxSize) {
      this.evictOldest();
    }

    this.store.set(fullKey, {
      value,
      createdAt: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : undefined,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(this.resolveKey(key));
  }

  async clear(): Promise<void> {
    if (this.namespace) {
      const prefix = `${this.namespace}:`;
      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) {
          this.store.delete(key);
        }
      }
    } else {
      this.store.clear();
    }
    this.stats = { hits: 0, misses: 0 };
  }

  async has(key: string): Promise<boolean> {
    const fullKey = this.resolveKey(key);
    const entry = this.store.get(fullKey);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(fullKey);
      return false;
    }
    return true;
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.store.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  private resolveKey(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}
