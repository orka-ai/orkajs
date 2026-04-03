import { Router } from 'express';
import type { Request, Response } from 'express';
import type { BaseAgent } from '@orka-js/agent';
import type { LLMStreamEvent } from '@orka-js/core';
import type { OrkaExpressConfig, AgentRunRequest } from './types.js';

const ORKA_VERSION = '1.0.0';

async function checkAuth(config: OrkaExpressConfig, req: Request): Promise<boolean> {
  if (!config.auth) return true;
  try {
    return await config.auth(req);
  } catch {
    return false;
  }
}

function setCors(res: Response, origin: string | false): void {
  if (origin === false) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

type StreamableAgent = BaseAgent & { runStream?: (input: string) => AsyncIterable<LLMStreamEvent> };
type GoalAgent = BaseAgent & { goal?: string };

export function orkaMiddleware(config: OrkaExpressConfig): ReturnType<typeof Router> {
  const router = Router();
  const corsOrigin = config.cors !== undefined ? config.cors : '*';

  router.options('*', (_req, res) => {
    setCors(res, corsOrigin);
    res.status(204).end();
  });

  // GET / — list agents
  router.get('/', async (req, res) => {
    setCors(res, corsOrigin);
    if (!(await checkAuth(config, req))) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const agents = Object.entries(config.agents).map(([name, agent]) => ({
      name,
      goal: (agent as GoalAgent).goal,
      streaming: typeof (agent as StreamableAgent).runStream === 'function',
    }));
    res.json({ agents, version: ORKA_VERSION });
  });

  // GET /:agent — agent info
  router.get('/:agent', async (req, res) => {
    setCors(res, corsOrigin);
    if (!(await checkAuth(config, req))) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const agent = config.agents[req.params.agent];
    if (!agent) {
      res.status(404).json({ error: `Agent "${req.params.agent}" not found`, available: Object.keys(config.agents) });
      return;
    }
    res.json({
      name: req.params.agent,
      goal: (agent as GoalAgent).goal,
      streaming: typeof (agent as StreamableAgent).runStream === 'function',
    });
  });

  // POST /:agent — run agent (non-streaming)
  router.post('/:agent', async (req, res) => {
    setCors(res, corsOrigin);
    if (!(await checkAuth(config, req))) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const agent = config.agents[req.params.agent];
    if (!agent) { res.status(404).json({ error: `Agent "${req.params.agent}" not found` }); return; }
    const body = req.body as AgentRunRequest;
    if (!body?.input) { res.status(400).json({ error: 'Request body must include "input" field' }); return; }
    try {
      const result = await agent.run(body.input);
      res.json({
        output: result.output,
        toolsUsed: result.toolsUsed,
        totalLatencyMs: result.totalLatencyMs,
        totalTokens: result.totalTokens,
        metadata: result.metadata,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /:agent/stream — SSE streaming
  router.post('/:agent/stream', async (req, res) => {
    setCors(res, corsOrigin);
    if (!(await checkAuth(config, req))) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const agent = config.agents[req.params.agent] as StreamableAgent | undefined;
    if (!agent) { res.status(404).json({ error: `Agent "${req.params.agent}" not found` }); return; }
    if (typeof agent.runStream !== 'function') {
      res.status(400).json({ error: `Agent "${req.params.agent}" does not support streaming` });
      return;
    }
    const body = req.body as AgentRunRequest;
    if (!body?.input) { res.status(400).json({ error: 'Request body must include "input" field' }); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
      for await (const event of agent.runStream(body.input)) {
        send(event);
        if (event.type === 'done' || event.type === 'error') break;
      }
    } catch (err) {
      send({ type: 'error', message: (err as Error).message });
    }
    res.end();
  });

  return router;
}
