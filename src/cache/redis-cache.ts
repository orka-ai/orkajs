import type { CacheStore, RedisCacheOptions, CacheStats } from './types.js';

export class RedisCache implements CacheStore {
  readonly name = 'redis-cache';
  private client: RedisLikeClient | null = null;
  private url: string;
  private keyPrefix: string;
  private defaultTtlMs?: number;
  private stats = { hits: 0, misses: 0 };

  constructor(options: RedisCacheOptions) {
    this.url = options.url;
    this.keyPrefix = options.keyPrefix ?? 'orka:';
    this.defaultTtlMs = options.ttlMs;
  }

  async connect(): Promise<void> {
    if (this.client) return;

    try {
      const redis = await import('redis');
      this.client = redis.createClient({ url: this.url }) as unknown as RedisLikeClient;
      await this.client.connect();
    } catch {
      throw new Error(
        'RedisCache requires the "redis" package. Install it with: npm install redis'
      );
    }
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    await this.ensureConnected();
    const fullKey = this.resolveKey(key);
    const raw = await this.client!.get(fullKey);

    if (!raw) {
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.ensureConnected();
    const fullKey = this.resolveKey(key);
    const serialized = JSON.stringify(value);
    const ttl = ttlMs ?? this.defaultTtlMs;

    if (ttl) {
      await this.client!.set(fullKey, serialized, { PX: ttl });
    } else {
      await this.client!.set(fullKey, serialized);
    }
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client!.del(this.resolveKey(key));
    return result > 0;
  }

  async clear(): Promise<void> {
    await this.ensureConnected();
    await this.scanDel(`${this.keyPrefix}*`);
    this.stats = { hits: 0, misses: 0 };
  }

  async has(key: string): Promise<boolean> {
    await this.ensureConnected();
    const exists = await this.client!.exists(this.resolveKey(key));
    return exists > 0;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: -1,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  private resolveKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client) {
      await this.connect();
    }
  }

  private async scanDel(pattern: string): Promise<void> {
    let cursor = 0;
    do {
      const result = await this.client!.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      if (result.keys.length > 0) {
        await this.client!.del(result.keys);
      }
    } while (cursor !== 0);
  }
}

interface RedisLikeClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { PX?: number }): Promise<unknown>;
  del(key: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: number, options?: { MATCH?: string; COUNT?: number }): Promise<{ cursor: number; keys: string[] }>;
  exists(key: string): Promise<number>;
}
