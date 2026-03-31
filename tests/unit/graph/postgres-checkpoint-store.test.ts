import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresCheckpointStore } from '@orka-js/graph';
import type { Checkpoint } from '@orka-js/graph';

const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockEnd = vi.fn().mockResolvedValue(undefined);
const MockPool = vi.fn().mockImplementation(() => ({ query: mockQuery, end: mockEnd }));

vi.mock('pg', () => ({ Pool: MockPool }));

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

describe('PostgresCheckpointStore', () => {
  let store: PostgresCheckpointStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new PostgresCheckpointStore({ connectionString: 'postgres://localhost/test' });
  });

  describe('initialize()', () => {
    it('creates the table and index', async () => {
      await store.initialize();
      const queries = mockQuery.mock.calls.map((c: unknown[]) => (c[0] as string).trim());
      expect(queries.some((q: string) => q.includes('CREATE TABLE IF NOT EXISTS'))).toBe(true);
      expect(queries.some((q: string) => q.includes('CREATE INDEX IF NOT EXISTS'))).toBe(true);
    });

    it('uses default schema "public" and table "orka_checkpoints"', async () => {
      await store.initialize();
      const tableQuery = mockQuery.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('CREATE TABLE')
      );
      expect(tableQuery?.[0]).toContain('"public"."orka_checkpoints"');
    });

    it('uses custom tableName when configured', async () => {
      const customStore = new PostgresCheckpointStore({
        connectionString: 'postgres://localhost/test',
        tableName: 'my_checkpoints',
      });
      await customStore.initialize();
      const tableQuery = mockQuery.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('CREATE TABLE')
      );
      expect(tableQuery?.[0]).toContain('"my_checkpoints"');
    });
  });

  describe('save()', () => {
    it('inserts checkpoint with all required fields', async () => {
      const ckpt = makeCheckpoint();
      await store.save(ckpt);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('INSERT INTO');
      expect(sql).toContain('ON CONFLICT');
      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('ckpt-1');
      expect(params[1]).toBe('thread-1');
    });

    it('serializes state as JSON', async () => {
      const ckpt = makeCheckpoint({ state: { messages: ['hello'] } });
      await store.save(ckpt);
      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params[2]).toBe(JSON.stringify({ messages: ['hello'] }));
    });
  });

  describe('load()', () => {
    it('returns null when checkpoint not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await store.load('nonexistent');
      expect(result).toBeNull();
    });

    it('maps DB row to Checkpoint object', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'ckpt-1',
          thread_id: 'thread-1',
          state: { messages: [] },
          current_node: 'node-a',
          path: ['node-a'],
          node_results: [],
          timestamp: 1000,
          parent_id: null,
          metadata: {},
          status: 'running',
          interrupt_reason: null,
          error: null,
        }],
      });
      const result = await store.load('ckpt-1');
      expect(result?.id).toBe('ckpt-1');
      expect(result?.threadId).toBe('thread-1');
      expect(result?.currentNode).toBe('node-a');
      expect(result?.status).toBe('running');
    });
  });

  describe('loadLatest()', () => {
    it('queries with ORDER BY timestamp DESC LIMIT 1', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await store.loadLatest('thread-1');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY timestamp DESC');
      expect(sql).toContain('LIMIT 1');
    });

    it('returns null when thread has no checkpoints', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await store.loadLatest('thread-1');
      expect(result).toBeNull();
    });
  });

  describe('list()', () => {
    it('queries with ORDER BY timestamp ASC', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await store.list('thread-1');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY timestamp ASC');
    });
  });

  describe('delete()', () => {
    it('deletes by checkpoint ID', async () => {
      await store.delete('ckpt-1');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('DELETE FROM');
      expect(mockQuery.mock.calls[0][1]).toEqual(['ckpt-1']);
    });
  });

  describe('deleteThread()', () => {
    it('deletes all checkpoints for a thread', async () => {
      await store.deleteThread('thread-1');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('DELETE FROM');
      expect(sql).toContain('thread_id');
      expect(mockQuery.mock.calls[0][1]).toEqual(['thread-1']);
    });
  });

  describe('disconnect()', () => {
    it('calls pool.end() and clears the pool', async () => {
      await store.initialize(); // trigger pool creation
      await store.disconnect();
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });
  });
});
