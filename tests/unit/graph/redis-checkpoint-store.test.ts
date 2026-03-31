import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisCheckpointStore } from '@orka-js/graph';
import type { Checkpoint } from '@orka-js/graph';

const store = new Map<string, string>();
const sets = new Map<string, Set<string>>();

const mockClient = {
  set: vi.fn().mockImplementation((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve('OK');
  }),
  get: vi.fn().mockImplementation((key: string) => {
    return Promise.resolve(store.get(key) ?? null);
  }),
  del: vi.fn().mockImplementation((keys: string | string[]) => {
    const ks = Array.isArray(keys) ? keys : [keys];
    ks.forEach(k => store.delete(k));
    return Promise.resolve(ks.length);
  }),
  sAdd: vi.fn().mockImplementation((key: string, member: string) => {
    if (!sets.has(key)) sets.set(key, new Set());
    sets.get(key)!.add(member);
    return Promise.resolve(1);
  }),
  sMembers: vi.fn().mockImplementation((key: string) => {
    return Promise.resolve([...(sets.get(key) ?? [])]);
  }),
  sRem: vi.fn().mockImplementation((key: string, member: string) => {
    sets.get(key)?.delete(member);
    return Promise.resolve(1);
  }),
  quit: vi.fn().mockResolvedValue('OK'),
};

const makeCheckpoint = (overrides?: Partial<Checkpoint>): Checkpoint => ({
  id: 'ckpt-1',
  threadId: 'thread-1',
  state: { messages: [] },
  currentNode: 'node-a',
  path: ['node-a'],
  nodeResults: [],
  timestamp: 1000,
  status: 'running',
  ...overrides,
});

describe('RedisCheckpointStore', () => {
  let redisStore: RedisCheckpointStore;

  beforeEach(() => {
    // Manually clear call history without resetting implementations
    Object.values(mockClient).forEach(fn => fn.mockClear());
    store.clear();
    sets.clear();
    // Inject the mock client directly via constructor (avoids dynamic import mocking issues)
    redisStore = new RedisCheckpointStore({ url: 'redis://localhost:6379' }, mockClient as never);
  });

  describe('save()', () => {
    it('stores checkpoint JSON in Redis', async () => {
      const ckpt = makeCheckpoint();
      await redisStore.save(ckpt);
      expect(mockClient.set).toHaveBeenCalledWith(
        expect.stringContaining('ckpt-1'),
        expect.any(String),
      );
    });

    it('adds checkpoint ID to thread set', async () => {
      const ckpt = makeCheckpoint();
      await redisStore.save(ckpt);
      expect(mockClient.sAdd).toHaveBeenCalledWith(
        expect.stringContaining('thread-1'),
        'ckpt-1',
      );
    });

    it('sets EX when ttlSeconds is configured', async () => {
      const ttlStore = new RedisCheckpointStore(
        { url: 'redis://localhost', ttlSeconds: 300 },
        mockClient as never,
      );
      await ttlStore.save(makeCheckpoint());
      expect(mockClient.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { EX: 300 },
      );
    });

    it('does not set EX by default', async () => {
      await redisStore.save(makeCheckpoint());
      expect(mockClient.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
      );
      expect(mockClient.set.mock.calls[0].length).toBe(2);
    });
  });

  describe('load()', () => {
    it('returns null when key does not exist', async () => {
      const result = await redisStore.load('nonexistent');
      expect(result).toBeNull();
    });

    it('returns deserialized checkpoint', async () => {
      const ckpt = makeCheckpoint();
      await redisStore.save(ckpt);
      const result = await redisStore.load('ckpt-1');
      expect(result?.id).toBe('ckpt-1');
      expect(result?.threadId).toBe('thread-1');
      expect(result?.status).toBe('running');
    });
  });

  describe('loadLatest()', () => {
    it('returns null for empty thread', async () => {
      const result = await redisStore.loadLatest('empty-thread');
      expect(result).toBeNull();
    });

    it('returns the checkpoint with highest timestamp', async () => {
      await redisStore.save(makeCheckpoint({ id: 'ckpt-1', timestamp: 1000 }));
      await redisStore.save(makeCheckpoint({ id: 'ckpt-2', timestamp: 3000 }));
      await redisStore.save(makeCheckpoint({ id: 'ckpt-3', timestamp: 2000 }));
      const result = await redisStore.loadLatest('thread-1');
      expect(result?.id).toBe('ckpt-2');
    });
  });

  describe('list()', () => {
    it('returns empty array for unknown thread', async () => {
      const result = await redisStore.list('unknown-thread');
      expect(result).toEqual([]);
    });

    it('returns checkpoints sorted by timestamp ascending', async () => {
      await redisStore.save(makeCheckpoint({ id: 'ckpt-1', timestamp: 3000 }));
      await redisStore.save(makeCheckpoint({ id: 'ckpt-2', timestamp: 1000 }));
      await redisStore.save(makeCheckpoint({ id: 'ckpt-3', timestamp: 2000 }));
      const results = await redisStore.list('thread-1');
      expect(results.map(c => c.id)).toEqual(['ckpt-2', 'ckpt-3', 'ckpt-1']);
    });
  });

  describe('delete()', () => {
    it('removes checkpoint from store and thread set', async () => {
      await redisStore.save(makeCheckpoint());
      await redisStore.delete('ckpt-1');
      expect(mockClient.del).toHaveBeenCalled();
      expect(mockClient.sRem).toHaveBeenCalled();
    });

    it('is safe to call for non-existent checkpoint', async () => {
      await expect(redisStore.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('deleteThread()', () => {
    it('removes all checkpoints and the thread index', async () => {
      await redisStore.save(makeCheckpoint({ id: 'ckpt-1' }));
      await redisStore.save(makeCheckpoint({ id: 'ckpt-2' }));
      await redisStore.deleteThread('thread-1');
      expect(mockClient.del).toHaveBeenCalled();
    });
  });

  describe('disconnect()', () => {
    it('calls client.quit()', async () => {
      await redisStore.disconnect();
      expect(mockClient.quit).toHaveBeenCalledTimes(1);
    });
  });

  describe('keyPrefix', () => {
    it('uses custom prefix when configured', async () => {
      const customStore = new RedisCheckpointStore(
        { url: 'redis://localhost', keyPrefix: 'myapp:ckpt:' },
        mockClient as never,
      );
      await customStore.save(makeCheckpoint());
      expect(mockClient.set).toHaveBeenCalledWith(
        expect.stringContaining('myapp:ckpt:'),
        expect.any(String),
      );
    });
  });
});
