import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { cors } from 'hono/cors';
import type { BaseAgent } from '@orka-js/agent';
import type { LLMStreamEvent } from '@orka-js/core';
import type { OrkaHonoConfig } from './types.js';

const ORKA_VERSION = '1.0.0';

type StreamableAgent = BaseAgent & { runStream?: (input: string) => AsyncIterable<LLMStreamEvent> };
type GoalAgent = BaseAgent & { goal?: string };

export function orkaHono(config: OrkaHonoConfig): Hono {
  const app = new Hono();

  app.use('*', cors());

  if (config.auth) {
    app.use('*', async (c, next) => {
      const allowed = await config.auth!(c);
      if (!allowed) return c.json({ error: 'Unauthorized' }, 401);
      return next();
    });
  }

  // GET / — list agents
  app.get('/', (c) => {
    const agents = Object.entries(config.agents).map(([name, agent]) => ({
      name,
      goal: (agent as GoalAgent).goal,
      streaming: typeof (agent as StreamableAgent).runStream === 'function',
    }));
    return c.json({ agents, version: ORKA_VERSION });
  });

  // GET /:agent — agent info
  app.get('/:agent', (c) => {
    const agentName = c.req.param('agent');
    const agent = config.agents[agentName];
    if (!agent) {
      return c.json({ error: `Agent "${agentName}" not found`, available: Object.keys(config.agents) }, 404);
    }
    return c.json({
      name: agentName,
      goal: (agent as GoalAgent).goal,
      streaming: typeof (agent as StreamableAgent).runStream === 'function',
    });
  });

  // POST /:agent — run agent (non-streaming)
  app.post('/:agent', async (c) => {
    const agentName = c.req.param('agent');
    const agent = config.agents[agentName];
    if (!agent) return c.json({ error: `Agent "${agentName}" not found` }, 404);

    const body = await c.req.json<{ input?: string; metadata?: Record<string, unknown> }>();
    if (!body?.input) return c.json({ error: 'Request body must include "input" field' }, 400);

    try {
      const result = await agent.run(body.input);
      return c.json({
        output: result.output,
        toolsUsed: result.toolsUsed,
        totalLatencyMs: result.totalLatencyMs,
        totalTokens: result.totalTokens,
        metadata: result.metadata,
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  // POST /:agent/stream — SSE streaming
  app.post('/:agent/stream', async (c) => {
    const agentName = c.req.param('agent');
    const agent = config.agents[agentName] as StreamableAgent | undefined;
    if (!agent) return c.json({ error: `Agent "${agentName}" not found` }, 404);
    if (typeof agent.runStream !== 'function') {
      return c.json({ error: `Agent "${agentName}" does not support streaming` }, 400);
    }

    const body = await c.req.json<{ input?: string }>();
    if (!body?.input) return c.json({ error: 'Request body must include "input" field' }, 400);

    const input = body.input;
    return stream(c, async (s) => {
      try {
        for await (const event of agent.runStream!(input)) {
          await s.writeln(`data: ${JSON.stringify(event)}`);
          if (event.type === 'done' || event.type === 'error') break;
        }
      } catch (err) {
        await s.writeln(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}`);
      }
    });
  });

  return app;
}
