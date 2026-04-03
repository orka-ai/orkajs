import type { Router } from 'express';
import type { BaseAgent } from '@orka-js/agent';

export function createApiRouter(
  agents: Record<string, BaseAgent>,
  wsBroadcast: (agentName: string, event: unknown) => void,
): Router {
  // Dynamic import of express to avoid bundling issues
  const { Router: ExpressRouter } = require('express') as typeof import('express');
  const router = ExpressRouter();

  // GET /api/agents — list all agents
  router.get('/agents', (_req, res) => {
    const list = Object.entries(agents).map(([name, agent]) => ({
      name,
      goal: (agent as { goal?: string }).goal ?? '',
    }));
    res.json({ agents: list, version: '1.5.0' });
  });

  // POST /api/agents/:name/run — run an agent (non-streaming)
  router.post('/agents/:name/run', async (req, res) => {
    const { name } = req.params;
    const agent = agents[name];
    if (!agent) {
      res.status(404).json({ error: `Agent "${name}" not found` });
      return;
    }

    const { input } = req.body as { input?: string };
    if (!input) {
      res.status(400).json({ error: 'Missing "input" in request body' });
      return;
    }

    try {
      const result = await agent.run(input);
      res.json({ result: result.output, usage: result.usage, steps: result.steps.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // POST /api/agents/:name/stream — stream agent (SSE)
  router.post('/agents/:name/stream', async (req, res) => {
    const { name } = req.params;
    const agent = agents[name];
    if (!agent) {
      res.status(404).json({ error: `Agent "${name}" not found` });
      return;
    }

    const { input } = req.body as { input?: string };
    if (!input) {
      res.status(400).json({ error: 'Missing "input" in request body' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      wsBroadcast(name, event);
    };

    try {
      if (typeof (agent as { runStream?: unknown }).runStream === 'function') {
        const streamAgent = agent as { runStream(input: string): AsyncIterable<unknown> };
        for await (const event of streamAgent.runStream(input)) {
          sendEvent(event);
        }
      } else {
        const result = await agent.run(input);
        sendEvent({ type: 'done', content: result.output });
      }
    } catch (error) {
      sendEvent({ type: 'error', message: (error as Error).message });
    } finally {
      res.end();
    }
  });

  return router;
}
