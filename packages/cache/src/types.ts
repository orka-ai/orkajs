export interface CacheStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  readonly name: string;
}

export interface CacheOptions {
  ttlMs?: number;
  maxSize?: number;
  namespace?: string;
}

export interface LLMCacheOptions extends CacheOptions {
  hashFn?: (prompt: string, options?: Record<string, unknown>) => string;
}

export interface EmbeddingCacheOptions extends CacheOptions {
  hashFn?: (text: string) => string;
}

export interface RedisCacheOptions extends CacheOptions {
  url: string;
  keyPrefix?: string;
}

export interface CacheEntry<T = unknown> {
  value: T;
  createdAt: number;
  expiresAt?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}
