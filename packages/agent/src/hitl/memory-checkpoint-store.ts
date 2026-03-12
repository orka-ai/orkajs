import type { Checkpoint, CheckpointStore } from './types.js';

export class MemoryCheckpointStore implements CheckpointStore {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private agentCheckpoints: Map<string, string[]> = new Map();

  async save(checkpoint: Checkpoint): Promise<void> {
    this.checkpoints.set(checkpoint.id, checkpoint);

    const agentList = this.agentCheckpoints.get(checkpoint.agentId) ?? [];
    if (!agentList.includes(checkpoint.id)) {
      agentList.push(checkpoint.id);
      this.agentCheckpoints.set(checkpoint.agentId, agentList);
    }
  }

  async load(checkpointId: string): Promise<Checkpoint | null> {
    return this.checkpoints.get(checkpointId) ?? null;
  }

  async loadLatest(agentId: string): Promise<Checkpoint | null> {
    const agentList = this.agentCheckpoints.get(agentId);
    if (!agentList || agentList.length === 0) return null;

    const latestId = agentList[agentList.length - 1];
    return this.checkpoints.get(latestId) ?? null;
  }

  async list(agentId: string): Promise<Checkpoint[]> {
    const agentList = this.agentCheckpoints.get(agentId) ?? [];
    return agentList
      .map(id => this.checkpoints.get(id))
      .filter((cp): cp is Checkpoint => cp !== undefined);
  }

  async delete(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      this.checkpoints.delete(checkpointId);
      const agentList = this.agentCheckpoints.get(checkpoint.agentId);
      if (agentList) {
        const idx = agentList.indexOf(checkpointId);
        if (idx !== -1) agentList.splice(idx, 1);
      }
    }
  }

  clear(): void {
    this.checkpoints.clear();
    this.agentCheckpoints.clear();
  }
}
