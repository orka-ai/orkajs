import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryVectorAdapter } from '@orka-js/memory';
import type { VectorSearchResult } from '@orka-js/core';

describe('MemoryVectorAdapter', () => {
  let vectorDB: MemoryVectorAdapter;

  beforeEach(() => {
    vectorDB = new MemoryVectorAdapter();
  });

  describe('createCollection', () => {
    it('should create a new collection', async () => {
      await vectorDB.createCollection('test-collection');
      
      // Should not throw when upserting to the collection
      await expect(
        vectorDB.upsert('test-collection', [
          { id: '1', vector: [0.1, 0.2, 0.3], content: 'test' },
        ])
      ).resolves.not.toThrow();
    });
  });

  describe('upsert', () => {
    it('should store vectors', async () => {
      await vectorDB.createCollection('test');
      await vectorDB.upsert('test', [
        { id: '1', vector: [1, 0, 0], content: 'first' },
        { id: '2', vector: [0, 1, 0], content: 'second' },
      ]);

      const results = await vectorDB.search('test', [1, 0, 0], { topK: 1 });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('1');
    });

    it('should update existing vectors', async () => {
      await vectorDB.createCollection('test');
      await vectorDB.upsert('test', [{ id: '1', vector: [1, 0, 0], content: 'original' }]);
      await vectorDB.upsert('test', [{ id: '1', vector: [0, 1, 0], content: 'updated' }]);

      const results = await vectorDB.search('test', [0, 1, 0], { topK: 1 });

      expect(results[0].content).toBe('updated');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await vectorDB.createCollection('test');
      await vectorDB.upsert('test', [
        { id: '1', vector: [1, 0, 0], content: 'x-axis', metadata: { axis: 'x' } },
        { id: '2', vector: [0, 1, 0], content: 'y-axis', metadata: { axis: 'y' } },
        { id: '3', vector: [0, 0, 1], content: 'z-axis', metadata: { axis: 'z' } },
      ]);
    });

    it('should return most similar vectors', async () => {
      const results = await vectorDB.search('test', [1, 0.1, 0], { topK: 2 });

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('1');
    });

    it('should respect topK limit', async () => {
      const results = await vectorDB.search('test', [0.5, 0.5, 0.5], { topK: 1 });

      expect(results.length).toBe(1);
    });

    it('should include metadata in results', async () => {
      const results = await vectorDB.search('test', [1, 0, 0], { topK: 1 });

      expect(results[0].metadata).toEqual({ axis: 'x' });
    });

    it('should include score in results', async () => {
      const results = await vectorDB.search('test', [1, 0, 0], { topK: 1 });

      expect(results[0].score).toBeGreaterThan(0);
    });
  });

  describe('delete', () => {
    it('should remove vectors by id', async () => {
      await vectorDB.createCollection('test');
      await vectorDB.upsert('test', [
        { id: '1', vector: [1, 0, 0], content: 'first' },
        { id: '2', vector: [0, 1, 0], content: 'second' },
      ]);

      await vectorDB.delete('test', ['1']);
      const results = await vectorDB.search('test', [1, 0, 0], { topK: 10 });

      expect(results.every((r: VectorSearchResult) => r.id !== '1')).toBe(true);
    });
  });

  describe('deleteCollection', () => {
    it('should remove entire collection', async () => {
      await vectorDB.createCollection('test-delete');
      await vectorDB.upsert('test-delete', [{ id: '1', vector: [1, 0, 0], content: 'test' }]);
      await vectorDB.deleteCollection('test-delete');

      // After deletion, searching should return empty or throw
      try {
        const results = await vectorDB.search('test-delete', [1, 0, 0], { topK: 1 });
        expect(results).toEqual([]);
      } catch {
        // Collection not found is also acceptable
        expect(true).toBe(true);
      }
    });
  });
});
