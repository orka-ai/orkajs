import type { BaseState, Checkpoint, CheckpointStore } from './types.js';

export interface RedisCheckpointStoreConfig {
  /** Redis connection URL: redis://localhost:6379 */
  url: string;
  /** Key prefix for all checkpoint keys — defaults to 'orka:ckpt:' */
  keyPrefix?: string;
  /** Optional TTL in seconds for auto-expiry of checkpoints */
  ttlSeconds?: number;
}

interface RedisClient {
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string | string[]): Promise<unknown>;
  sAdd(key: string, value: string): Promise<unknown>;
  sMembers(key: string): Promise<string[]>;
  sRem(key: string, value: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

/**
 * Redis-backed checkpoint store for StateGraph.
 *
 * Each checkpoint is stored as a JSON string at `${keyPrefix}${id}`.
 * Thread membership is tracked with a Redis SET at `${keyPrefix}thread:${threadId}`.
 *
 * @example
 * const store = new RedisCheckpointStore({ url: process.env.REDIS_URL! });
 * // No initialization needed — connects lazily on first use.
 */
export class RedisCheckpointStore<S extends BaseState = BaseState>
  implements CheckpointStore<S> {

  private client: RedisClient | null = null;
  private config: Required<RedisCheckpointStoreConfig>;

  /**
   * @param config - Redis connection options
   * @param _client - Optional pre-built client (used in tests for dependency injection)
   */
  constructor(config: RedisCheckpointStoreConfig, _client?: RedisClient) {
    this.config = {
      keyPrefix: 'orka:ckpt:',
      ttlSeconds: 0,
      ...config,
    };
    if (_client) this.client = _client;
  }

  private checkpointKey(id: string): string {
    return `${this.config.keyPrefix}${id}`;
  }

  private threadKey(threadId: string): string {
    return `${this.config.keyPrefix}thread:${threadId}`;
  }

  private async getClient(): Promise<RedisClient> {
    if (!this.client) {
      const redisModule = await import('redis') as unknown as {
        createClient(opts: { url: string }): RedisClient & { connect(): Promise<unknown> };
      };
      const c = redisModule.createClient({ url: this.config.url });
      await c.connect();
      this.client = c;
    }
    return this.client;
  }

  async save(checkpoint: Checkpoint<S>): Promise<void> {
    const client = await this.getClient();
    const key = this.checkpointKey(checkpoint.id);
    const serialized = JSON.stringify(checkpoint);

    if (this.config.ttlSeconds > 0) {
      await client.set(key, serialized, { EX: this.config.ttlSeconds });
    } else {
      await client.set(key, serialized);
    }

    await client.sAdd(this.threadKey(checkpoint.threadId), checkpoint.id);
  }

  async load(checkpointId: string): Promise<Checkpoint<S> | null> {
    const client = await this.getClient();
    const raw = await client.get(this.checkpointKey(checkpointId));
    if (!raw) return null;
    return JSON.parse(raw) as Checkpoint<S>;
  }

  async loadLatest(threadId: string): Promise<Checkpoint<S> | null> {
    const client = await this.getClient();
    const ids = await client.sMembers(this.threadKey(threadId));
    if (ids.length === 0) return null;

    const checkpoints = (await Promise.all(ids.map(id => this.load(id))))
      .filter((c): c is Checkpoint<S> => c !== null);

    if (checkpoints.length === 0) return null;
    return checkpoints.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  async list(threadId: string): Promise<Checkpoint<S>[]> {
    const client = await this.getClient();
    const ids = await client.sMembers(this.threadKey(threadId));
    if (ids.length === 0) return [];

    const checkpoints = (await Promise.all(ids.map(id => this.load(id))))
      .filter((c): c is Checkpoint<S> => c !== null);

    return checkpoints.sort((a, b) => a.timestamp - b.timestamp);
  }

  async delete(checkpointId: string): Promise<void> {
    const client = await this.getClient();
    const checkpoint = await this.load(checkpointId);
    if (checkpoint) {
      await client.sRem(this.threadKey(checkpoint.threadId), checkpointId);
    }
    await client.del(this.checkpointKey(checkpointId));
  }

  async deleteThread(threadId: string): Promise<void> {
    const client = await this.getClient();
    const ids = await client.sMembers(this.threadKey(threadId));
    if (ids.length > 0) {
      await client.del(ids.map(id => this.checkpointKey(id)));
    }
    await client.del(this.threadKey(threadId));
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
