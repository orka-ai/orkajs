declare module 'redis' {
  interface RedisClientOptions {
    url?: string;
  }

  interface RedisClient {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { PX?: number }): Promise<unknown>;
    del(key: string | string[]): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    exists(key: string): Promise<number>;
  }

  function createClient(options?: RedisClientOptions): RedisClient;
}
