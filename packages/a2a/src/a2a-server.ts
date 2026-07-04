import { Router } from 'express';
import type { BaseAgent } from '@orka-js/agent';
import type {
  AgentCard,
  A2ATask,
  A2ATaskState,
  JsonRpcRequest,
  JsonRpcResponse,
} from './types.js';

export interface A2AServerConfig {
  agent: BaseAgent;
  card: Omit<AgentCard, 'url'>;
  /** Base URL where this server is accessible (used in agent card) */
  baseUrl?: string;
}

/**
 * Exposes an OrkaJS agent via the Google A2A protocol (JSON-RPC 2.0 over HTTP).
 *
 * Endpoints:
 * - `GET /.well-known/agent.json` — Agent Card
 * - `POST /` — `tasks/send` and `tasks/sendSubscribe` (SSE)
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { A2AServer } from '@orka-js/a2a';
 *
 * const server = new A2AServer({
 *   agent: myAgent,
 *   card: { name: 'Assistant', description: '...', version: '1.0.0', capabilities: {...}, skills: [] },
 *   baseUrl: 'http://localhost:3000',
 * });
 *
 * const app = express();
 * app.use(server.handler());
 * app.listen(3000);
 * ```
 */
export class A2AServer {
  private agent: BaseAgent;
  private cardConfig: Omit<AgentCard, 'url'>;
  private baseUrl: string;

  constructor(config: A2AServerConfig) {
    this.agent = config.agent;
    this.cardConfig = config.card;
    this.baseUrl = config.baseUrl ?? 'http://localhost:3000';
  }

  getAgentCard(): AgentCard {
    return {
      ...this.cardConfig,
      url: this.baseUrl,
    };
  }

  /**
   * Returns an Express middleware (Router) that handles A2A protocol requests.
   */
  handler(): import('express').Router {
    const router = Router();

    // Agent Card endpoint
    router.get('/.well-known/agent.json', (_req: import('express').Request, res: import('express').Response) => {
      res.json(this.getAgentCard());
    });

    // JSON-RPC 2.0 endpoint
    router.post('/', async (req: import('express').Request, res: import('express').Response) => {
      const body = req.body as JsonRpcRequest | undefined;

      try {
        if (!body || body.jsonrpc !== '2.0' || !body.method) {
          res.json(this.rpcError(body?.id ?? 0, -32600, 'Invalid Request'));
          return;
        }

        switch (body.method) {
          case 'tasks/send':
            await this.handleTaskSend(body, res);
            break;
          case 'tasks/sendSubscribe':
            await this.handleTaskSubscribe(body, req, res);
            break;
          default:
            res.json(this.rpcError(body.id, -32601, `Method not found: ${body.method}`));
        }
      } catch (error) {
        // Ensure no promise rejection escapes to Express 4 (which would crash the process).
        if (res.headersSent) {
          res.end();
        } else {
          res.json(this.rpcError(body?.id ?? 0, -32603, (error as Error).message));
        }
      }
    });

    return router;
  }

  /**
   * Validates that JSON-RPC params match the A2ATask shape and returns the
   * parsed task plus its joined text input, or null when the params are invalid.
   */
  private parseTaskParams(params: unknown): { task: A2ATask; input: string } | null {
    if (!params || typeof params !== 'object') {
      return null;
    }
    const task = params as A2ATask;
    const parts = task.message?.parts;
    if (!Array.isArray(parts) || !parts.every(p => p && typeof p.text === 'string')) {
      return null;
    }
    return { task, input: parts.map(p => p.text).join('\n') };
  }

  private async handleTaskSend(
    req: JsonRpcRequest,
    res: import('express').Response,
  ): Promise<void> {
    const parsed = this.parseTaskParams(req.params);
    if (!parsed) {
      res.json(this.rpcError(req.id, -32602, 'Invalid params'));
      return;
    }
    const { task, input } = parsed;

    try {
      const result = await this.agent.run(input);

      const taskState: A2ATaskState = {
        id: task.id,
        sessionId: task.sessionId,
        status: { state: 'completed', timestamp: new Date().toISOString() },
        artifacts: [{
          parts: [{ type: 'text', text: result.output }],
        }],
      };

      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: req.id,
        result: taskState,
      };
      res.json(response);
    } catch (error) {
      res.json(this.rpcError(req.id, -32000, (error as Error).message));
    }
  }

  private async handleTaskSubscribe(
    req: JsonRpcRequest,
    _expressReq: import('express').Request,
    res: import('express').Response,
  ): Promise<void> {
    const parsed = this.parseTaskParams(req.params);
    if (!parsed) {
      res.json(this.rpcError(req.id, -32602, 'Invalid params'));
      return;
    }
    const { task, input } = parsed;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send "working" status
    sendEvent({
      jsonrpc: '2.0',
      id: req.id,
      result: {
        id: task.id,
        status: { state: 'working', timestamp: new Date().toISOString() },
      } satisfies A2ATaskState,
    });

    try {
      if (typeof (this.agent as { runStream?: unknown }).runStream === 'function') {
        const streamAgent = this.agent as unknown as { runStream(input: string): AsyncIterable<{ type: string; token?: string; content?: string; message?: string }> };
        let fullContent = '';
        let streamError: string | null = null;

        for await (const event of streamAgent.runStream(input)) {
          if (event.type === 'error') {
            // Agents yield (not throw) error events, so catch them here to
            // avoid reporting a failed run as 'completed'.
            streamError = event.message ?? 'Agent stream error';
            break;
          } else if (event.type === 'token' && event.token) {
            fullContent += event.token;
            sendEvent({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                id: task.id,
                status: {
                  state: 'working',
                  message: { role: 'agent', parts: [{ type: 'text', text: fullContent }] },
                  timestamp: new Date().toISOString(),
                },
              } satisfies A2ATaskState,
            });
          } else if (event.type === 'done') {
            fullContent = event.content ?? fullContent;
          }
        }

        if (streamError) {
          sendEvent({
            jsonrpc: '2.0',
            id: req.id,
            result: {
              id: task.id,
              status: {
                state: 'failed',
                message: { role: 'agent', parts: [{ type: 'text', text: streamError }] },
                timestamp: new Date().toISOString(),
              },
            } satisfies A2ATaskState,
          });
        } else {
          sendEvent({
            jsonrpc: '2.0',
            id: req.id,
            result: {
              id: task.id,
              status: { state: 'completed', timestamp: new Date().toISOString() },
              artifacts: [{ parts: [{ type: 'text', text: fullContent }] }],
            } satisfies A2ATaskState,
          });
        }
      } else {
        const result = await this.agent.run(input);
        sendEvent({
          jsonrpc: '2.0',
          id: req.id,
          result: {
            id: task.id,
            status: { state: 'completed', timestamp: new Date().toISOString() },
            artifacts: [{ parts: [{ type: 'text', text: result.output }] }],
          } satisfies A2ATaskState,
        });
      }
    } catch (error) {
      sendEvent(this.rpcError(req.id, -32000, (error as Error).message));
    } finally {
      res.end();
    }
  }

  private rpcError(id: string | number, code: number, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}
