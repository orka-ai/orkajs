import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Knowledge } from '@orka-js/core';
import type { LLMAdapter, VectorDBAdapter } from '@orka-js/core';

const createMockLLM = (): LLMAdapter => ({
  name: 'mock',
  generate: vi.fn().mockResolvedValue({ content: 'ok', usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }, model: 'mock', finishReason: 'stop' }),
  embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
});

const createMockVectorDB = (): VectorDBAdapter => ({
  name: 'mock-vector',
  upsert: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue([{ id: '1', score: 0.9, content: 'found content', metadata: {} }]),
  delete: vi.fn().mockResolvedValue(undefined),
  createCollection: vi.fn().mockResolvedValue(undefined),
  deleteCollection: vi.fn().mockResolvedValue(undefined),
});

describe('Knowledge', () => {
  let llm: LLMAdapter;
  let vectorDB: VectorDBAdapter;
  let knowledge: Knowledge;

  beforeEach(() => {
    llm = createMockLLM();
    vectorDB = createMockVectorDB();
    knowledge = new Knowledge(llm, vectorDB, {});
  });

  describe('create()', () => {
    it('creates a collection and upserts chunks', async () => {
      const result = await knowledge.create({ name: 'docs', source: 'Hello world content for indexing purposes.' });
      expect(vectorDB.createCollection).toHaveBeenCalledWith('docs', expect.any(Object));
      expect(vectorDB.upsert).toHaveBeenCalled();
      expect(result.name).toBe('docs');
      expect(result.chunkCount).toBeGreaterThan(0);
    });

    it('calls embed on document content', async () => {
      await knowledge.create({ name: 'docs', source: 'Some content to embed.' });
      expect(llm.embed).toHaveBeenCalled();
    });

    it('handles array of strings as source', async () => {
      const result = await knowledge.create({ name: 'docs', source: ['First doc.', 'Second doc.'] });
      expect(result.documentCount).toBe(2);
      expect(vectorDB.upsert).toHaveBeenCalled();
    });

    it('handles array of objects with text/metadata as source', async () => {
      const result = await knowledge.create({
        name: 'docs',
        source: [
          { text: 'First document.', metadata: { source: 'a' } },
          { text: 'Second document.', metadata: { source: 'b' } },
        ],
      });
      expect(result.documentCount).toBe(2);
    });

    it('throws when source is empty string', async () => {
      await expect(knowledge.create({ name: 'docs', source: '' })).rejects.toThrow();
    });
  });

  describe('add()', () => {
    it('upserts chunks without creating a new collection', async () => {
      await knowledge.create({ name: 'docs', source: 'Initial content.' });
      vi.clearAllMocks();
      const result = await knowledge.add('docs', 'Additional content to add.');
      expect(vectorDB.upsert).toHaveBeenCalled();
      expect(vectorDB.createCollection).not.toHaveBeenCalled();
      expect(result.addedChunks).toBeGreaterThan(0);
    });

    it('calls embed for added content', async () => {
      await knowledge.create({ name: 'docs', source: 'Initial.' });
      vi.clearAllMocks();
      await knowledge.add('docs', 'New content.');
      expect(llm.embed).toHaveBeenCalled();
    });
  });

  describe('search()', () => {
    it('embeds the query and calls vectorDB.search', async () => {
      await knowledge.create({ name: 'docs', source: 'Some content.' });
      vi.clearAllMocks();
      const results = await knowledge.search('docs', 'query text');
      expect(llm.embed).toHaveBeenCalledWith(['query text']);
      expect(vectorDB.search).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('passes topK option to vectorDB.search', async () => {
      await knowledge.create({ name: 'docs', source: 'Content.' });
      vi.clearAllMocks();
      await knowledge.search('docs', 'query', { topK: 3 });
      expect(vectorDB.search).toHaveBeenCalledWith('docs', expect.any(Array), expect.objectContaining({ topK: 3 }));
    });
  });

  describe('delete()', () => {
    it('calls vectorDB.deleteCollection', async () => {
      await knowledge.create({ name: 'docs', source: 'Content.' });
      await knowledge.delete('docs');
      expect(vectorDB.deleteCollection).toHaveBeenCalledWith('docs');
    });
  });

  describe('batching', () => {
    it('calls upsert multiple times for large sources', async () => {
      // Create 110 documents to exceed the batch size of 100
      const source = Array.from({ length: 110 }, (_, i) => `Document ${i} with some content.`);
      await knowledge.create({ name: 'large', source });
      const upsertCalls = (vectorDB.upsert as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(upsertCalls).toBeGreaterThan(1);
    });
  });
});
