import { describe, it, expect, beforeEach } from 'vitest';
import { DurableAgent } from '../durable-agent.js';
import { MemoryDurableStore } from '../stores/memory-store.js';
import type { BaseAgent } from '@orka-js/agent';
import type { AgentResult } from '@orka-js/agent';

function createMockAgent(output = 'Mock result', shouldFail = false): BaseAgent {
  return {
    goal: 'test',
    run: async (input: string): Promise<AgentResult> => {
      if (shouldFail) throw new Error('Agent failed');
      return {
        input,
        output,
        steps: [],
        totalLatencyMs: 10,
        totalTokens: 50,
        toolsUsed: [],
        metadata: {},
      };
    },
    on: function () { return this as BaseAgent; },
    off: function () { return this as BaseAgent; },
  } as unknown as BaseAgent;
}

describe('DurableAgent', () => {
  let store: MemoryDurableStore;
  let durable: DurableAgent;

  beforeEach(() => {
    store = new MemoryDurableStore();
    durable = new DurableAgent(createMockAgent(), store);
  });

  it('creates and completes a job', async () => {
    const job = await durable.run('job-1', 'Hello');
    expect(job.status).toBe('completed');
    expect(job.result).toBe('Mock result');
    expect(job.id).toBe('job-1');
  });

  it('persists job to store', async () => {
    await durable.run('job-1', 'Hello');
    const stored = await store.load('job-1');
    expect(stored?.status).toBe('completed');
  });

  it('does not re-run already completed jobs', async () => {
    await durable.run('job-1', 'First run');
    const job = await durable.run('job-1', 'Second run');
    expect(job.status).toBe('completed');
    expect(job.result).toBe('Mock result');
  });

  it('marks jobs as failed when agent throws', async () => {
    const failingDurable = new DurableAgent(createMockAgent('', true), store);
    const job = await failingDurable.run('job-fail', 'Hello');
    expect(job.status).toBe('failed');
    expect(job.error).toBe('Agent failed');
  });

  it('retries failed jobs up to maxRetries', async () => {
    let attempts = 0;
    const flaky = {
      goal: 'test',
      run: async (): Promise<AgentResult> => {
        attempts++;
        if (attempts < 2) throw new Error('temporary failure');
        return { input: '', output: 'success after retry', steps: [], totalLatencyMs: 0, totalTokens: 0, toolsUsed: [], metadata: {} };
      },
      on: function () { return this as BaseAgent; },
      off: function () { return this as BaseAgent; },
    } as unknown as BaseAgent;

    const retryDurable = new DurableAgent(flaky, store, { maxRetries: 2, retryDelayMs: 0 });
    const job = await retryDurable.run('job-retry', 'Hello');
    expect(job.status).toBe('completed');
    expect(job.result).toBe('success after retry');
    expect(attempts).toBe(2);
  });

  it('can cancel a job', async () => {
    await durable.run('job-1', 'Hello');
    const j = await store.load('job-1');
    if (j) { j.status = 'paused'; await store.save(j); }

    await durable.cancel('job-1');
    const cancelled = await durable.status('job-1');
    expect(cancelled?.status).toBe('cancelled');
  });

  it('lists all jobs', async () => {
    await durable.run('job-1', 'Hello');
    await durable.run('job-2', 'World');
    const jobs = await durable.list();
    expect(jobs).toHaveLength(2);
  });

  it('filters jobs by status', async () => {
    await durable.run('job-1', 'Hello');
    const completed = await durable.list({ status: 'completed' });
    const pending = await durable.list({ status: 'pending' });
    expect(completed).toHaveLength(1);
    expect(pending).toHaveLength(0);
  });
});

describe('MemoryDurableStore', () => {
  it('saves and loads jobs', async () => {
    const s = new MemoryDurableStore();
    const job = { id: 'test', input: 'hi', status: 'pending' as const, attempts: 0, createdAt: new Date(), updatedAt: new Date() };
    await s.save(job);
    const loaded = await s.load('test');
    expect(loaded?.id).toBe('test');
  });

  it('returns null for missing jobs', async () => {
    const s = new MemoryDurableStore();
    expect(await s.load('missing')).toBeNull();
  });

  it('deletes jobs', async () => {
    const s = new MemoryDurableStore();
    const job = { id: 'del', input: 'x', status: 'completed' as const, attempts: 1, createdAt: new Date(), updatedAt: new Date() };
    await s.save(job);
    await s.delete('del');
    expect(await s.load('del')).toBeNull();
  });
});
