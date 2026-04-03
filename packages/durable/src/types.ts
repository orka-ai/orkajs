import type { LLMStreamEvent } from '@orka-js/core';

export type DurableJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface DurableJob {
  id: string;
  input: string;
  status: DurableJobStatus;
  result?: string;
  error?: string;
  /** Saved conversation messages for resuming */
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  /** Number of retry attempts so far */
  attempts: number;
}

export interface DurableStore {
  save(job: DurableJob): Promise<void>;
  load(jobId: string): Promise<DurableJob | null>;
  list(filter?: { status?: DurableJobStatus }): Promise<DurableJob[]>;
  delete(jobId: string): Promise<void>;
}

export interface DurableAgentConfig {
  /** Max retries on failure — default 0 */
  maxRetries?: number;
  /** Delay between retries in ms — default 1000 */
  retryDelayMs?: number;
  /** Cron expression for scheduled runs (requires node-cron peer dep) */
  schedule?: string;
  /** Called on each scheduled run to produce the input string */
  onSchedule?: () => Promise<string> | string;
  /** Metadata to attach to every job */
  metadata?: Record<string, unknown>;
}

export type DurableStreamEvent = LLMStreamEvent | { type: 'job_status'; job: DurableJob };
