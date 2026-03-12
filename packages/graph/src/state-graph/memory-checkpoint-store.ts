import type { BaseState, Checkpoint, CheckpointStore } from './types.js';

/**
 * In-memory checkpoint store for development and testing
 */
export class MemoryCheckpointStore<S extends BaseState = BaseState> implements CheckpointStore<S> {
  private checkpoints: Map<string, Checkpoint<S>> = new Map();
  private threadIndex: Map<string, string[]> = new Map();

  async save(checkpoint: Checkpoint<S>): Promise<void> {
    this.checkpoints.set(checkpoint.id, { ...checkpoint });
    
    const threadCheckpoints = this.threadIndex.get(checkpoint.threadId) ?? [];
    if (!threadCheckpoints.includes(checkpoint.id)) {
      threadCheckpoints.push(checkpoint.id);
      this.threadIndex.set(checkpoint.threadId, threadCheckpoints);
    }
  }

  async load(checkpointId: string): Promise<Checkpoint<S> | null> {
    const checkpoint = this.checkpoints.get(checkpointId);
    return checkpoint ? { ...checkpoint } : null;
  }

  async loadLatest(threadId: string): Promise<Checkpoint<S> | null> {
    const checkpointIds = this.threadIndex.get(threadId);
    if (!checkpointIds || checkpointIds.length === 0) {
      return null;
    }

    let latest: Checkpoint<S> | null = null;
    let latestTimestamp = 0;

    for (const id of checkpointIds) {
      const checkpoint = this.checkpoints.get(id);
      if (checkpoint && checkpoint.timestamp > latestTimestamp) {
        latest = checkpoint;
        latestTimestamp = checkpoint.timestamp;
      }
    }

    return latest ? { ...latest } : null;
  }

  async list(threadId: string): Promise<Checkpoint<S>[]> {
    const checkpointIds = this.threadIndex.get(threadId) ?? [];
    const checkpoints: Checkpoint<S>[] = [];

    for (const id of checkpointIds) {
      const checkpoint = this.checkpoints.get(id);
      if (checkpoint) {
        checkpoints.push({ ...checkpoint });
      }
    }

    return checkpoints.sort((a, b) => a.timestamp - b.timestamp);
  }

  async delete(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      const threadCheckpoints = this.threadIndex.get(checkpoint.threadId);
      if (threadCheckpoints) {
        const index = threadCheckpoints.indexOf(checkpointId);
        if (index !== -1) {
          threadCheckpoints.splice(index, 1);
        }
      }
      this.checkpoints.delete(checkpointId);
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    const checkpointIds = this.threadIndex.get(threadId) ?? [];
    for (const id of checkpointIds) {
      this.checkpoints.delete(id);
    }
    this.threadIndex.delete(threadId);
  }

  /**
   * Clear all checkpoints (useful for testing)
   */
  clear(): void {
    this.checkpoints.clear();
    this.threadIndex.clear();
  }

  /**
   * Get total number of checkpoints
   */
  size(): number {
    return this.checkpoints.size;
  }
}
