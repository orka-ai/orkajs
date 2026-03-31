import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgVectorAdapter } from '@orka-js/pgvector';

const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockEnd = vi.fn().mockResolvedValue(undefined);
const MockPool = vi.fn().mockImplementation(() => ({ query: mockQuery, end: mockEnd }));

vi.mock('pg', () => ({ Pool: MockPool }));

describe('PgVectorAdapter', () => {
  let adapter: PgVectorAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PgVectorAdapter({ connectionString: 'postgres://localhost/test' });
  });

  describe('createCollection()', () => {
    it('creates the extension, table, and index', async () => {
      await adapter.createCollection('my_docs');
      const queries = mockQuery.mock.calls.map((c: unknown[]) => (c[0] as string).trim());
      expect(queries.some((q: string) => q.includes('CREATE EXTENSION IF NOT EXISTS vector'))).toBe(true);
      expect(queries.some((q: string) => q.includes('CREATE TABLE IF NOT EXISTS'))).toBe(true);
      expect(queries.some((q: string) => q.includes('CREATE INDEX IF NOT EXISTS'))).toBe(true);
    });

    it('uses cosine ops by default', async () => {
      await adapter.createCollection('my_docs');
      const indexQuery = mockQuery.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('CREATE INDEX')
      );
      expect(indexQuery?.[0]).toContain('vector_cosine_ops');
    });

    it('uses euclidean ops when metric is euclidean', async () => {
      await adapter.createCollection('my_docs', { metric: 'euclidean' });
      const indexQuery = mockQuery.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('CREATE INDEX')
      );
      expect(indexQuery?.[0]).toContain('vector_l2_ops');
    });

    it('throws on invalid collection name with spaces', async () => {
      await expect(adapter.createCollection('my docs')).rejects.toThrow('Invalid collection name');
    });

    it('throws on collection name with special characters', async () => {
      await expect(adapter.createCollection('my-docs')).rejects.toThrow('Invalid collection name');
    });
  });

  describe('upsert()', () => {
    it('calls pool.query for each vector with ::vector cast', async () => {
      await adapter.createCollection('docs');
      mockQuery.mockClear();
      await adapter.upsert('docs', [
        { id: 'v1', vector: [0.1, 0.2, 0.3], content: 'first' },
        { id: 'v2', vector: [0.4, 0.5, 0.6], content: 'second' },
        { id: 'v3', vector: [0.7, 0.8, 0.9], content: 'third' },
      ]);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('uses ::vector cast in the SQL', async () => {
      await adapter.createCollection('docs');
      mockQuery.mockClear();
      await adapter.upsert('docs', [{ id: 'v1', vector: [0.1, 0.2], content: 'text' }]);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('::vector');
    });

    it('includes ON CONFLICT DO UPDATE for upsert semantics', async () => {
      await adapter.createCollection('docs');
      mockQuery.mockClear();
      await adapter.upsert('docs', [{ id: 'v1', vector: [0.1], content: 'text' }]);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE');
    });
  });

  describe('search()', () => {
    it('returns mapped VectorSearchResult array', async () => {
      await adapter.createCollection('docs');
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'v1', content: 'hello', metadata: { source: 'test' }, score: '0.95' },
        ],
      });
      const results = await adapter.search('docs', [0.1, 0.2, 0.3]);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('v1');
      expect(results[0].score).toBe(0.95);
      expect(results[0].content).toBe('hello');
    });

    it('uses ::vector cast and LIMIT in the query', async () => {
      await adapter.createCollection('docs');
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await adapter.search('docs', [0.1, 0.2], { topK: 3 });
      const searchCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
      expect(searchCall[0]).toContain('::vector');
      expect(searchCall[1]).toContain(3);
    });

    it('filters by minScore', async () => {
      await adapter.createCollection('docs');
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'v1', content: 'high', metadata: {}, score: '0.9' },
          { id: 'v2', content: 'low', metadata: {}, score: '0.3' },
        ],
      });
      const results = await adapter.search('docs', [0.1], { minScore: 0.5 });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('v1');
    });
  });

  describe('delete()', () => {
    it('issues DELETE WHERE id = ANY($1)', async () => {
      await adapter.createCollection('docs');
      mockQuery.mockClear();
      await adapter.delete('docs', ['v1', 'v2']);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('DELETE FROM');
      expect(sql).toContain('ANY($1)');
      expect(mockQuery.mock.calls[0][1]).toEqual([['v1', 'v2']]);
    });
  });

  describe('deleteCollection()', () => {
    it('issues DROP TABLE IF EXISTS ... CASCADE', async () => {
      await adapter.createCollection('docs');
      mockQuery.mockClear();
      await adapter.deleteCollection('docs');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('DROP TABLE IF EXISTS');
      expect(sql).toContain('CASCADE');
    });
  });

  describe('disconnect()', () => {
    it('calls pool.end() and clears the pool', async () => {
      await adapter.createCollection('docs'); // triggers pool creation
      await adapter.disconnect();
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });

    it('is safe to call multiple times', async () => {
      await adapter.disconnect();
      await adapter.disconnect();
      expect(mockEnd).toHaveBeenCalledTimes(0); // pool was never created
    });
  });

  describe('name', () => {
    it('is "pgvector"', () => {
      expect(adapter.name).toBe('pgvector');
    });
  });
});
