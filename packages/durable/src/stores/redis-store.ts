import type { DurableJob, DurableJobStatus, DurableStore } from '../types.js';

export interface RedisDurableStoreConfig {
  /** Redis connection URL — default 'redis://localhost:6379' */
  url?: string;
  /** Key prefix — default 'orka:durable:' */
  prefix?: string;
  /** TTL for terminal jobs (completed/failed/cancelled) in seconds — default 7 days */
  ttlSeconds?: number;
}

type RedisClient = {
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  mGet(keys: string[]): Promise<(string | null)[]>;
};

/**
 * Redis-backed durable store for production use.
 * Requires the `redis` package as a peer dependency.
 *
 * @example
 * ```typescript
 * import { RedisDurableStore } from '@orka-js/durable'
 * const store = new RedisDurableStore({ url: process.env.REDIS_URL })
 * ```
 */
export class RedisDurableStore implements DurableStore {
  private client: RedisClient | null = null;
  private prefix: string;
  private ttlSeconds: number;
  private url: string;

  constructor(config: RedisDurableStoreConfig = {}) {
    this.url = config.url ?? 'redis://localhost:6379';
    this.prefix = config.prefix ?? 'orka:durable:';
    this.ttlSeconds = config.ttlSeconds ?? 60 * 60 * 24 * 7;
  }

  private async getClient(): Promise<RedisClient> {
    if (this.client) return this.client;

    let redis: { createClient(config: { url: string }): RedisClient };
    try {
      redis = await import('redis') as unknown as typeof redis;
    } catch {
      throw new Error(
        '@orka-js/durable: RedisDurableStore requires the "redis" package.\n' +
        'Install it with: npm install redis'
      );
    }

    const client = redis.createClient({ url: this.url });
    await client.connect();
    this.client = client;
    return client;
  }

  private key(jobId: string): string {
    return `${this.prefix}${jobId}`;
  }

  private serialize(job: DurableJob): string {
    return JSON.stringify({
      ...job,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    });
  }

  private deserialize(raw: string): DurableJob {
    const data = JSON.parse(raw) as unknown as DurableJob & { createdAt: string; updatedAt: string; completedAt?: string };
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    };
  }

  async save(job: DurableJob): Promise<void> {
    const client = await this.getClient();
    await client.set(this.key(job.id), this.serialize(job));
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      await client.expire(this.key(job.id), this.ttlSeconds);
    }
  }

  async load(jobId: string): Promise<DurableJob | null> {
    const client = await this.getClient();
    const raw = await client.get(this.key(jobId));
    return raw ? this.deserialize(raw) : null;
  }

  async list(filter?: { status?: DurableJobStatus }): Promise<DurableJob[]> {
    const client = await this.getClient();
    const keys = await client.keys(`${this.prefix}*`);
    if (keys.length === 0) return [];
    const raws = await client.mGet(keys);
    const jobs = raws
      .filter((r): r is string => r !== null)
      .map(r => this.deserialize(r));
    if (filter?.status) return jobs.filter(j => j.status === filter.status);
    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async delete(jobId: string): Promise<void> {
    const client = await this.getClient();
    await client.del(this.key(jobId));
  }
}
