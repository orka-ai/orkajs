import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KGMemory, type KGMemoryConfig } from '@orka-js/memory-store';

describe('KGMemory', () => {
  const mockLLM = {
    generate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM.generate.mockResolvedValue(JSON.stringify({
      entities: [
        { name: 'John', type: 'PERSON', attributes: { role: 'developer' } },
        { name: 'Acme Corp', type: 'ORGANIZATION', attributes: {} },
      ],
      relations: [
        { subject: 'John', predicate: 'works at', object: 'Acme Corp' },
      ],
    }));
  });

  const createMemory = (config: Partial<KGMemoryConfig> = {}) => {
    return new KGMemory({
      llm: mockLLM,
      maxMessages: 100,
      extractionBatchSize: 2,
      ...config,
    });
  };

  describe('addMessage', () => {
    it('should add a message to history', async () => {
      const memory = createMemory();

      await memory.addMessage({ role: 'user', content: 'Hello' });

      const history = memory.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Hello');
    });

    it('should add timestamp if not provided', async () => {
      const memory = createMemory();
      const before = Date.now();

      await memory.addMessage({ role: 'user', content: 'Hello' });

      const history = memory.getHistory();
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe('knowledge extraction', () => {
    it('should extract entities when batch size is reached', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme Corp' });
      await memory.addMessage({ role: 'assistant', content: 'I see John is at Acme' });

      expect(mockLLM.generate).toHaveBeenCalled();

      const entities = memory.getEntities();
      expect(entities.length).toBeGreaterThan(0);
    });

    it('should extract relations between entities', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme Corp' });
      await memory.addMessage({ role: 'assistant', content: 'Got it' });

      const relations = memory.getRelations();
      expect(relations.length).toBeGreaterThan(0);
      expect(relations[0].predicate).toBe('works at');
    });

    it('should create knowledge triples', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme Corp' });
      await memory.addMessage({ role: 'assistant', content: 'Got it' });

      const triples = memory.getTriples();
      expect(triples.length).toBeGreaterThan(0);
    });
  });

  describe('getEntity', () => {
    it('should find entity by name (case insensitive)', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme' });
      await memory.addMessage({ role: 'assistant', content: 'OK' });

      const entity = memory.getEntity('JOHN');
      expect(entity).toBeDefined();
      expect(entity?.name).toBe('John');
    });

    it('should return undefined for unknown entity', async () => {
      const memory = createMemory();

      const entity = memory.getEntity('Unknown');
      expect(entity).toBeUndefined();
    });
  });

  describe('getRelationsFor', () => {
    it('should find relations for an entity', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme' });
      await memory.addMessage({ role: 'assistant', content: 'OK' });

      const relations = memory.getRelationsFor('John');
      expect(relations.length).toBeGreaterThan(0);
    });
  });

  describe('queryKnowledge', () => {
    it('should query the knowledge graph', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme' });
      await memory.addMessage({ role: 'assistant', content: 'OK' });

      mockLLM.generate.mockResolvedValueOnce('John is a developer at Acme Corp');

      const result = await memory.queryKnowledge('Where does John work?');
      expect(result).toBeTruthy();
    });

    it('should return empty string when graph is empty', async () => {
      const memory = createMemory();

      const result = await memory.queryKnowledge('test');
      expect(result).toBe('');
    });
  });

  describe('getContextForQuery', () => {
    it('should return context message plus recent messages', async () => {
      const memory = createMemory({ extractionBatchSize: 2, preserveRecentMessages: 5 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme' });
      await memory.addMessage({ role: 'assistant', content: 'OK' });

      mockLLM.generate.mockResolvedValueOnce('John works at Acme Corp');

      const context = await memory.getContextForQuery('Where does John work?');

      expect(context.length).toBeGreaterThan(0);
      const kgContext = context.find(m => m.metadata?.isKGContext);
      expect(kgContext).toBeDefined();
    });
  });

  describe('getGraphSummary', () => {
    it('should return graph statistics', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme' });
      await memory.addMessage({ role: 'assistant', content: 'OK' });

      const summary = memory.getGraphSummary();

      expect(summary.entityCount).toBeGreaterThan(0);
      expect(summary.relationCount).toBeGreaterThan(0);
    });
  });

  describe('forceExtraction', () => {
    it('should extract knowledge even below batch threshold', async () => {
      const memory = createMemory({ extractionBatchSize: 10 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme' });

      expect(mockLLM.generate).not.toHaveBeenCalled();

      await memory.forceExtraction();

      expect(mockLLM.generate).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear messages and graph', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme' });
      await memory.addMessage({ role: 'assistant', content: 'OK' });

      memory.clear();

      expect(memory.getHistory()).toHaveLength(0);
      expect(memory.getEntities()).toHaveLength(0);
      expect(memory.getRelations()).toHaveLength(0);
    });
  });

  describe('clearGraph', () => {
    it('should clear only the graph, not messages', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme' });
      await memory.addMessage({ role: 'assistant', content: 'OK' });

      memory.clearGraph();

      expect(memory.getHistory()).toHaveLength(2);
      expect(memory.getEntities()).toHaveLength(0);
    });
  });

  describe('getRecentMessages', () => {
    it('should return recent messages', async () => {
      const memory = createMemory({ preserveRecentMessages: 2 });

      await memory.addMessage({ role: 'user', content: 'First' });
      await memory.addMessage({ role: 'assistant', content: 'Second' });
      await memory.addMessage({ role: 'user', content: 'Third' });

      const recent = memory.getRecentMessages();

      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('Second');
      expect(recent[1].content).toBe('Third');
    });
  });

  describe('toJSON / fromJSON', () => {
    it('should serialize and deserialize correctly', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      await memory.addMessage({ role: 'user', content: 'John works at Acme' });
      await memory.addMessage({ role: 'assistant', content: 'OK' });

      const json = memory.toJSON();
      const restored = KGMemory.fromJSON(json as any, mockLLM);

      expect(restored.getHistory()).toHaveLength(2);
      expect(restored.getEntities().length).toBeGreaterThan(0);
    });
  });

  describe('trimming', () => {
    it('should trim old messages when exceeding maxMessages', async () => {
      const memory = createMemory({ maxMessages: 2, extractionBatchSize: 10 });

      await memory.addMessage({ role: 'user', content: 'First' });
      await memory.addMessage({ role: 'assistant', content: 'Second' });
      await memory.addMessage({ role: 'user', content: 'Third' });

      expect(memory.getMessageCount()).toBe(2);
    });

    it('should trim graph when exceeding maxTriples', async () => {
      const memory = createMemory({ maxTriples: 1, extractionBatchSize: 2 });

      mockLLM.generate.mockResolvedValue(JSON.stringify({
        entities: [
          { name: 'A', type: 'CONCEPT' },
          { name: 'B', type: 'CONCEPT' },
          { name: 'C', type: 'CONCEPT' },
        ],
        relations: [
          { subject: 'A', predicate: 'relates to', object: 'B' },
          { subject: 'B', predicate: 'relates to', object: 'C' },
        ],
      }));

      await memory.addMessage({ role: 'user', content: 'A relates to B' });
      await memory.addMessage({ role: 'assistant', content: 'B relates to C' });

      const triples = memory.getTriples();
      expect(triples.length).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON from LLM gracefully', async () => {
      const memory = createMemory({ extractionBatchSize: 2 });

      mockLLM.generate.mockResolvedValue('This is not valid JSON');

      await memory.addMessage({ role: 'user', content: 'Hello' });
      await memory.addMessage({ role: 'assistant', content: 'Hi' });

      expect(memory.getEntities()).toHaveLength(0);
      expect(memory.getRelations()).toHaveLength(0);
    });
  });
});
