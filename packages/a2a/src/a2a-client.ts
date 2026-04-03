import type {
  AgentCard,
  A2ATask,
  A2ATaskState,
  JsonRpcRequest,
  JsonRpcResponse,
} from './types.js';

export interface A2AClientConfig {
  /** Base URL of the remote A2A agent */
  baseUrl: string;
  timeoutMs?: number;
}

let _idCounter = 1;

/**
 * Client for communicating with remote A2A-compatible agents.
 *
 * @example
 * ```typescript
 * const client = new A2AClient({ baseUrl: 'http://remote-agent:3000' });
 * const card = await client.getAgentCard();
 * const result = await client.sendTask('What is the weather in Paris?');
 * console.log(result.artifacts?.[0].parts[0].text);
 * ```
 */
export class A2AClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: A2AClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  /** Fetch the agent card from the remote agent. */
  async getAgentCard(): Promise<AgentCard> {
    const res = await fetch(`${this.baseUrl}/.well-known/agent.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch agent card: ${res.status}`);
    }
    return res.json() as Promise<AgentCard>;
  }

  /**
   * Send a task and wait for the completed result (non-streaming).
   */
  async sendTask(
    input: string,
    sessionId?: string,
  ): Promise<A2ATaskState> {
    const task: A2ATask = {
      id: `task-${Date.now()}`,
      sessionId,
      message: { role: 'user', parts: [{ type: 'text', text: input }] },
    };

    const rpcReq: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: _idCounter++,
      method: 'tasks/send',
      params: task,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(this.baseUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcReq),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`A2A request failed: ${res.status}`);
    }

    const rpcRes = await res.json() as JsonRpcResponse;
    if (rpcRes.error) {
      throw new Error(`A2A error ${rpcRes.error.code}: ${rpcRes.error.message}`);
    }

    return rpcRes.result as A2ATaskState;
  }

  /**
   * Send a task with streaming (SSE) and yield task state updates.
   */
  async *sendTaskStream(
    input: string,
    sessionId?: string,
  ): AsyncIterable<A2ATaskState> {
    const task: A2ATask = {
      id: `task-${Date.now()}`,
      sessionId,
      message: { role: 'user', parts: [{ type: 'text', text: input }] },
    };

    const rpcReq: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: _idCounter++,
      method: 'tasks/sendSubscribe',
      params: task,
    };

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcReq),
    });

    if (!res.ok || !res.body) {
      throw new Error(`A2A stream request failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const rpcRes = JSON.parse(line.slice(6)) as JsonRpcResponse;
            if (rpcRes.error) {
              throw new Error(`A2A error ${rpcRes.error.code}: ${rpcRes.error.message}`);
            }
            if (rpcRes.result) {
              yield rpcRes.result as A2ATaskState;
            }
          } catch (e) {
            if ((e as Error).message.includes('A2A error')) throw e;
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
