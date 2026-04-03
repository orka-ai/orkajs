import { describe, it, expect } from 'vitest';
import { orkaHono } from '../app.js';
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

describe('orkaHono', () => {
  it('creates a Hono app', () => {
    const app = orkaHono({ agents: { test: createMockAgent() } });
    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe('function');
  });

  it('GET / returns agent list', async () => {
    const app = orkaHono({ agents: { myAgent: createMockAgent() } });
    const res = await app.request('/', { method: 'GET' });
    expect(res.status).toBe(200);
    const data = await res.json() as { agents: Array<{ name: string }> };
    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].name).toBe('myAgent');
  });

  it('POST /:agent runs the agent', async () => {
    const app = orkaHono({ agents: { chat: createMockAgent('Hello World') } });
    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Hi' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { output: string };
    expect(data.output).toBe('Hello World');
  });

  it('returns 404 for unknown agent', async () => {
    const app = orkaHono({ agents: {} });
    const res = await app.request('/unknown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'test' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when input is missing', async () => {
    const app = orkaHono({ agents: { test: createMockAgent() } });
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
