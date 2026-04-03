import type { LLMStreamEvent } from '@orka-js/core';
import type { BaseAgent } from '@orka-js/agent';
import type { DurableAgentConfig, DurableJob, DurableJobStatus, DurableStore } from './types.js';

function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): Date {
  return new Date();
}

type StreamableAgent = BaseAgent & {
  runStream?: (input: string) => AsyncIterable<LLMStreamEvent>;
};

export class DurableAgent {
  private agent: StreamableAgent;
  private store: DurableStore;
  private config: DurableAgentConfig;
  private schedulerHandle: unknown = null;

  constructor(
    agent: BaseAgent,
    store: DurableStore,
    config: DurableAgentConfig = {},
  ) {
    this.agent = agent as StreamableAgent;
    this.store = store;
    this.config = { maxRetries: 0, retryDelayMs: 1000, ...config };
  }

  /**
   * Run a job by ID.
   * - Creates a new job if jobId doesn't exist yet.
   * - If the job is already completed/cancelled, returns it as-is.
   * - If paused, call resume() instead.
   */
  async run(jobId: string, input: string): Promise<DurableJob> {
    let job = await this.store.load(jobId);

    if (!job) {
      job = {
        id: jobId,
        input,
        status: 'pending',
        attempts: 0,
        metadata: this.config.metadata,
        createdAt: now(),
        updatedAt: now(),
      };
      await this.store.save(job);
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      return job;
    }

    job.status = 'running';
    job.updatedAt = now();
    job.attempts++;
    await this.store.save(job);

    try {
      const result = await this.agent.run(input);
      job.status = 'completed';
      job.result = result.output;
      job.completedAt = now();
    } catch (error) {
      const err = error as Error;
      job.error = err.message;

      if (job.attempts <= (this.config.maxRetries ?? 0)) {
        job.status = 'pending';
        job.updatedAt = now();
        await this.store.save(job);
        if (this.config.retryDelayMs) {
          await new Promise(r => setTimeout(r, this.config.retryDelayMs));
        }
        return this.run(jobId, input);
      }

      job.status = 'failed';
    }

    job.updatedAt = now();
    await this.store.save(job);
    return job;
  }

  /**
   * Streaming run — yields LLM stream events plus job_status bookends.
   */
  async *runStream(
    jobId: string,
    input: string,
  ): AsyncIterable<LLMStreamEvent | { type: 'job_status'; job: DurableJob }> {
    let job = await this.store.load(jobId);

    if (!job) {
      job = {
        id: jobId,
        input,
        status: 'pending',
        attempts: 0,
        metadata: this.config.metadata,
        createdAt: now(),
        updatedAt: now(),
      };
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      yield { type: 'job_status', job };
      return;
    }

    job.status = 'running';
    job.updatedAt = now();
    job.attempts++;
    await this.store.save(job);
    yield { type: 'job_status', job: { ...job } };

    try {
      if (typeof this.agent.runStream === 'function') {
        let finalContent = '';
        for await (const event of this.agent.runStream(input)) {
          yield event;
          if (event.type === 'done') finalContent = event.content;
        }
        job.status = 'completed';
        job.result = finalContent;
      } else {
        const result = await this.agent.run(input);
        job.status = 'completed';
        job.result = result.output;
      }
      job.completedAt = now();
    } catch (error) {
      job.status = 'failed';
      job.error = (error as Error).message;
    }

    job.updatedAt = now();
    await this.store.save(job);
    yield { type: 'job_status', job: { ...job } };
  }

  /** Pause a running job (marks as paused — the caller must stop feeding input). */
  async pause(jobId: string): Promise<void> {
    const job = await this.store.load(jobId);
    if (!job) throw new Error(`Job "${jobId}" not found`);
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new Error(`Cannot pause a ${job.status} job`);
    }
    job.status = 'paused';
    job.updatedAt = now();
    await this.store.save(job);
  }

  /** Resume a paused job with optional new input. */
  async resume(jobId: string, newInput?: string): Promise<DurableJob> {
    const job = await this.store.load(jobId);
    if (!job) throw new Error(`Job "${jobId}" not found`);
    if (job.status !== 'paused') {
      throw new Error(`Job "${jobId}" is not paused (current status: ${job.status})`);
    }
    return this.run(jobId, newInput ?? job.input);
  }

  /** Cancel a job. */
  async cancel(jobId: string): Promise<void> {
    const job = await this.store.load(jobId);
    if (!job) throw new Error(`Job "${jobId}" not found`);
    job.status = 'cancelled';
    job.updatedAt = now();
    await this.store.save(job);
  }

  /** Get job status. */
  async status(jobId: string): Promise<DurableJob | null> {
    return this.store.load(jobId);
  }

  /** List all jobs, optionally filtered by status. */
  async list(filter?: { status?: DurableJobStatus }): Promise<DurableJob[]> {
    return this.store.list(filter);
  }

  /**
   * Start a cron-scheduled agent (requires `node-cron` peer dep).
   * @param schedule - Cron expression, e.g. '0 9 * * MON'
   * @param inputFn - Function returning the input for each run
   */
  startScheduler(): void {
    if (!this.config.schedule) throw new Error('DurableAgent: no schedule configured');
    if (!this.config.onSchedule) throw new Error('DurableAgent: no onSchedule handler configured');

    import('node-cron').then(cron => {
      this.schedulerHandle = (cron as {
        schedule(expr: string, fn: () => void): unknown;
      }).schedule(this.config.schedule!, async () => {
        const input = await this.config.onSchedule!();
        const jobId = generateId();
        await this.run(jobId, input);
      });
    }).catch(() => {
      throw new Error(
        '@orka-js/durable: startScheduler() requires the "node-cron" package.\n' +
        'Install it with: npm install node-cron'
      );
    });
  }

  stopScheduler(): void {
    if (this.schedulerHandle && typeof (this.schedulerHandle as { stop?: () => void }).stop === 'function') {
      (this.schedulerHandle as { stop(): void }).stop();
      this.schedulerHandle = null;
    }
  }
}
