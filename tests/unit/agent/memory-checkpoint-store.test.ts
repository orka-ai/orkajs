import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCheckpointStore } from '@orka-js/agent';
import type { Checkpoint } from '@orka-js/agent';

describe('MemoryCheckpointStore', () => {
  let store: MemoryCheckpointStore;

  const createCheckpoint = (overrides: Partial<Checkpoint> = {}): Checkpoint => ({
    id: `checkpoint-${Date.now()}`,
    agentId: 'test-agent',
    stepNumber: 1,
    state: {
      input: 'test input',
      steps: [],
      context: {},
    },
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    store = new MemoryCheckpointStore();
  });

  describe('save', () => {
    it('should save a checkpoint', async () => {
      const checkpoint = createCheckpoint({ id: 'cp-1' });
      await store.save(checkpoint);

      const loaded = await store.load('cp-1');
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe('cp-1');
    });

    it('should overwrite existing checkpoint with same id', async () => {
      const checkpoint1 = createCheckpoint({ id: 'cp-1', stepNumber: 1 });
      const checkpoint2 = createCheckpoint({ id: 'cp-1', stepNumber: 5 });

      await store.save(checkpoint1);
      await store.save(checkpoint2);

      const loaded = await store.load('cp-1');
      expect(loaded?.stepNumber).toBe(5);
    });
  });

  describe('load', () => {
    it('should return null for non-existent checkpoint', async () => {
      const result = await store.load('non-existent');
      expect(result).toBeNull();
    });

    it('should load existing checkpoint', async () => {
      const checkpoint = createCheckpoint({ id: 'cp-load' });
      await store.save(checkpoint);

      const loaded = await store.load('cp-load');
      expect(loaded).toEqual(checkpoint);
    });
  });

  describe('loadLatest', () => {
    it('should return null when no checkpoints exist', async () => {
      const result = await store.loadLatest('agent-1');
      expect(result).toBeNull();
    });

    it('should return the most recent checkpoint for an agent', async () => {
      const older = createCheckpoint({
        id: 'cp-old',
        agentId: 'agent-1',
        createdAt: new Date('2024-01-01'),
      });
      const newer = createCheckpoint({
        id: 'cp-new',
        agentId: 'agent-1',
        createdAt: new Date('2024-01-02'),
      });

      await store.save(older);
      await store.save(newer);

      const latest = await store.loadLatest('agent-1');
      expect(latest?.id).toBe('cp-new');
    });

    it('should only return checkpoints for the specified agent', async () => {
      const agent1Checkpoint = createCheckpoint({
        id: 'cp-agent1',
        agentId: 'agent-1',
        createdAt: new Date('2024-01-02'),
      });
      const agent2Checkpoint = createCheckpoint({
        id: 'cp-agent2',
        agentId: 'agent-2',
        createdAt: new Date('2024-01-03'),
      });

      await store.save(agent1Checkpoint);
      await store.save(agent2Checkpoint);

      const latest = await store.loadLatest('agent-1');
      expect(latest?.id).toBe('cp-agent1');
    });
  });

  describe('list', () => {
    it('should return empty array when no checkpoints exist', async () => {
      const result = await store.list('agent-1');
      expect(result).toEqual([]);
    });

    it('should return all checkpoints for an agent', async () => {
      const cp1 = createCheckpoint({ id: 'cp-1', agentId: 'agent-1' });
      const cp2 = createCheckpoint({ id: 'cp-2', agentId: 'agent-1' });
      const cp3 = createCheckpoint({ id: 'cp-3', agentId: 'agent-2' });

      await store.save(cp1);
      await store.save(cp2);
      await store.save(cp3);

      const result = await store.list('agent-1');
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toContain('cp-1');
      expect(result.map((c) => c.id)).toContain('cp-2');
    });
  });

  describe('delete', () => {
    it('should delete an existing checkpoint', async () => {
      const checkpoint = createCheckpoint({ id: 'cp-delete' });
      await store.save(checkpoint);

      await store.delete('cp-delete');

      const loaded = await store.load('cp-delete');
      expect(loaded).toBeNull();
    });

    it('should not throw when deleting non-existent checkpoint', async () => {
      await expect(store.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all checkpoints', async () => {
      await store.save(createCheckpoint({ id: 'cp-1', agentId: 'agent-1' }));
      await store.save(createCheckpoint({ id: 'cp-2', agentId: 'agent-2' }));

      await store.clear();

      expect(await store.list('agent-1')).toEqual([]);
      expect(await store.list('agent-2')).toEqual([]);
    });
  });
});
