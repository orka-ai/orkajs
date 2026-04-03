import { describe, it, expect } from 'vitest';
import { orkaMiddleware } from '../middleware.js';
import type { BaseAgent, AgentResult } from '@orka-js/agent';

function createMockAgent(output = 'test output'): BaseAgent {
  return {
    goal: 'test',
    run: async (input: string): Promise<AgentResult> => ({
      input,
      output,
      steps: [],
      totalLatencyMs: 10,
      totalTokens: 50,
      toolsUsed: [],
      metadata: {},
    }),
    on: function () { return this as BaseAgent; },
    off: function () { return this as BaseAgent; },
  } as unknown as BaseAgent;
}

describe('orkaMiddleware', () => {
  it('returns a router function', () => {
    const router = orkaMiddleware({ agents: { test: createMockAgent() } });
    expect(typeof router).toBe('function');
  });

  it('exports are correct types', () => {
    expect(typeof orkaMiddleware).toBe('function');
  });
});
