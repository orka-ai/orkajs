import type { DurableJob, DurableJobStatus, DurableStore } from '../types.js';

/**
 * In-memory durable store — suitable for development and testing.
 * Data is lost on process restart.
 */
export class MemoryDurableStore implements DurableStore {
  private jobs: Map<string, DurableJob> = new Map();

  async save(job: DurableJob): Promise<void> {
    this.jobs.set(job.id, { ...job });
  }

  async load(jobId: string): Promise<DurableJob | null> {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  async list(filter?: { status?: DurableJobStatus }): Promise<DurableJob[]> {
    const all = [...this.jobs.values()].map(j => ({ ...j }));
    if (filter?.status) {
      return all.filter(j => j.status === filter.status);
    }
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async delete(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  clear(): void {
    this.jobs.clear();
  }

  size(): number {
    return this.jobs.size;
  }
}
