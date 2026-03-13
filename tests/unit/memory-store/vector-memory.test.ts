import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VectorMemory, type VectorMemoryConfig } from '@orka-js/memory-store';

describe('VectorMemory', () => {
  const mockEmbeddings = {
    embed: vi.fn(),
    embedBatch: vi.fn(),
  };

  const mockVectorDB = {
    add: vi.fn(),
    search: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
    mockEmbeddings.embedBatch.mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);
    mockVectorDB.add.mockResolvedValue(['id1', 'id2']);
    mockVectorDB.search.mockResolvedValue([]);
    mockVectorDB.delete.mockResolvedValue(undefined);
  });

  const createMemory = (config: Partial<VectorMemoryConfig> = {}) => {
    return new VectorMemory({
      embeddings: mockEmbeddings,
      vectorDB: mockVectorDB,
      maxMessages: 100,
      searchTopK: 5,
      ...config,
    });
  };

  describe('addMessage', () => {
    it('should add a message and create embedding', async () => {
      const memory = createMemory();

      const id = await memory.addMessage({ role: 'user', content: 'Hello' });

      expect(id).toBeTruthy();
      expect(mockEmbeddings.embed).toHaveBeenCalledWith('Hello');
      expect(mockVectorDB.add).toHaveBeenCalled();
    });

    it('should store message in history', async () => {
      const memory = createMemory();

      await memory.addMessage({ role: 'user', content: 'Hello' });

      const history = memory.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Hello');
    });

    it('should include metadata in vector store', async () => {
      const memory = createMemory({ includeMetadata: true });

      await memory.addMessage({
        role: 'user',
        content: 'Hello',
        metadata: { userId: '123' },
      });

      expect(mockVectorDB.add).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({ userId: '123' }),
        ])
      );
    });
  });

  describe('addMessages', () => {
    it('should add multiple messages with batch embedding', async () => {
      const memory = createMemory();

      const ids = await memory.addMessages([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ]);

      expect(ids).toHaveLength(2);
      expect(mockEmbeddings.embedBatch).toHaveBeenCalledWith(['Hello', 'Hi there']);
    });
  });

  describe('search', () => {
    it('should search for relevant messages', async () => {
      mockVectorDB.search.mockResolvedValue([
        { id: 'id1', document: 'Hello', score: 0.9, metadata: { role: 'user' } },
      ]);

      const memory = createMemory();
      await memory.addMessage({ role: 'user', content: 'Hello' });

      const results = await memory.search('greeting');

      expect(mockEmbeddings.embed).toHaveBeenCalledWith('greeting');
      expect(mockVectorDB.search).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0.9);
    });

    it('should filter results below similarity threshold', async () => {
      mockVectorDB.search.mockResolvedValue([
        { id: 'id1', document: 'Hello', score: 0.5, metadata: { role: 'user' } },
      ]);

      const memory = createMemory({ similarityThreshold: 0.7 });

      const results = await memory.search('greeting');

      expect(results).toHaveLength(0);
    });

    it('should respect topK parameter', async () => {
      const memory = createMemory({ searchTopK: 3 });

      await memory.search('query', 10);

      expect(mockVectorDB.search).toHaveBeenCalledWith(expect.any(Array), 10);
    });
  });

  describe('searchWithContext', () => {
    it('should return messages with surrounding context', async () => {
      const memory = createMemory({ chunkSize: 1 });

      await memory.addMessage({ role: 'user', content: 'First' });
      await memory.addMessage({ role: 'assistant', content: 'Second' });
      await memory.addMessage({ role: 'user', content: 'Third' });

      mockVectorDB.search.mockResolvedValue([
        {
          id: 'msg_test_1',
          document: 'Second',
          score: 0.9,
          metadata: { role: 'assistant', messageId: 'msg_test_1' },
        },
      ]);

      const results = await memory.searchWithContext('query');

      expect(results).toHaveLength(1);
    });
  });

  describe('getRelevantHistory', () => {
    it('should return unique messages sorted by timestamp', async () => {
      const memory = createMemory();

      await memory.addMessage({ role: 'user', content: 'Hello', timestamp: 1000 });
      await memory.addMessage({ role: 'assistant', content: 'Hi', timestamp: 2000 });

      mockVectorDB.search.mockResolvedValue([
        { id: 'id1', document: 'Hello', score: 0.9, metadata: { role: 'user', timestamp: 1000 } },
      ]);

      const relevant = await memory.getRelevantHistory('greeting');

      expect(relevant.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getRecentMessages', () => {
    it('should return last N messages', async () => {
      const memory = createMemory();

      await memory.addMessage({ role: 'user', content: 'First' });
      await memory.addMessage({ role: 'assistant', content: 'Second' });
      await memory.addMessage({ role: 'user', content: 'Third' });

      const recent = memory.getRecentMessages(2);

      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('Second');
      expect(recent[1].content).toBe('Third');
    });
  });

  describe('clear', () => {
    it('should clear all messages and delete from vector store', async () => {
      const memory = createMemory();

      await memory.addMessage({ role: 'user', content: 'Hello' });
      await memory.clear();

      expect(mockVectorDB.delete).toHaveBeenCalled();
      expect(memory.getHistory()).toHaveLength(0);
      expect(memory.getMessageCount()).toBe(0);
    });
  });

  describe('trimming', () => {
    it('should trim old messages when exceeding maxMessages', async () => {
      const memory = createMemory({ maxMessages: 2 });

      await memory.addMessage({ role: 'user', content: 'First' });
      await memory.addMessage({ role: 'assistant', content: 'Second' });
      await memory.addMessage({ role: 'user', content: 'Third' });

      expect(mockVectorDB.delete).toHaveBeenCalled();
      expect(memory.getMessageCount()).toBe(2);
    });
  });

  describe('toJSON', () => {
    it('should serialize memory state', async () => {
      const memory = createMemory();

      await memory.addMessage({ role: 'user', content: 'Hello' });

      const json = memory.toJSON() as any;

      expect(json.messages).toHaveLength(1);
      expect(json.config.maxMessages).toBe(100);
    });
  });
});
