import { Controller, Get, Post, Param, Body, Res, HttpException, HttpStatus, Inject, Type } from '@nestjs/common';
import type { BaseAgent } from '@orka-js/agent';
import type { LLMStreamEvent } from '@orka-js/core';
import { ORKA_AGENTS_MAP } from './tokens.js';
import type { AgentRunRequest, AgentRunResponse } from './types.js';

const ORKA_VERSION = '1.0.0';

type StreamableAgent = BaseAgent & { runStream?: (input: string) => AsyncIterable<LLMStreamEvent> };
type GoalAgent = BaseAgent & { goal?: string };

/**
 * Creates a NestJS controller class dynamically bound to a given path and agents map.
 *
 * The factory pattern is required because NestJS reads @Controller(path) at class
 * decoration time — before runtime config is available. By creating the class inside
 * the factory, we can apply the decorator with a runtime value.
 *
 * SSE streaming uses @Post + @Res() rather than NestJS's @Sse() decorator in order
 * to match the existing API contract of @orka-js/express and @orka-js/hono.
 * This allows clients to use the same POST-based streaming pattern across all adapters.
 *
 * @param path    - Controller route prefix (without leading slash)
 * @param agentsMap - Map of agent name → agent instance (closed over in the class)
 */
export function createOrkaController(path: string, agentsMap: Record<string, BaseAgent>): Type<unknown> {
  @Controller(path)
  class OrkaController {
    @Get()
    listAgents(): object {
      const agents = Object.entries(agentsMap).map(([name, agent]) => ({
        name,
        goal: (agent as GoalAgent).goal,
        streaming: typeof (agent as StreamableAgent).runStream === 'function',
      }));
      return { agents, version: ORKA_VERSION };
    }

    @Get(':agent')
    getAgent(@Param('agent') name: string): object {
      const agent = agentsMap[name];
      if (!agent) {
        throw new HttpException(
          { error: `Agent "${name}" not found`, available: Object.keys(agentsMap) },
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        name,
        goal: (agent as GoalAgent).goal,
        streaming: typeof (agent as StreamableAgent).runStream === 'function',
      };
    }

    @Post(':agent')
    async runAgent(
      @Param('agent') name: string,
      @Body() body: AgentRunRequest,
    ): Promise<AgentRunResponse> {
      const agent = agentsMap[name];
      if (!agent) {
        throw new HttpException({ error: `Agent "${name}" not found` }, HttpStatus.NOT_FOUND);
      }
      if (!body?.input) {
        throw new HttpException(
          { error: 'Request body must include "input" field' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const result = await agent.run(body.input);
      return {
        output: result.output,
        toolsUsed: result.toolsUsed,
        totalLatencyMs: result.totalLatencyMs,
        totalTokens: result.totalTokens,
        metadata: result.metadata,
      };
    }

    @Post(':agent/stream')
    async streamAgent(
      @Param('agent') name: string,
      @Body() body: AgentRunRequest,
      @Res() res: { setHeader(k: string, v: string): void; write(chunk: string): void; end(): void },
    ): Promise<void> {
      const agent = agentsMap[name] as StreamableAgent | undefined;
      if (!agent) {
        throw new HttpException({ error: `Agent "${name}" not found` }, HttpStatus.NOT_FOUND);
      }
      if (typeof agent.runStream !== 'function') {
        throw new HttpException(
          { error: `Agent "${name}" does not support streaming` },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!body?.input) {
        throw new HttpException(
          { error: 'Request body must include "input" field' },
          HttpStatus.BAD_REQUEST,
        );
      }

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
    }
  }

  return OrkaController;
}

/**
 * Creates a NestJS controller class that injects the agents map from DI.
 * Used by OrkaModule.forRootAsync() where the agents are resolved asynchronously —
 * the controller path is provided statically but agents come from DI.
 *
 * @param path - Controller route prefix (without leading slash)
 */
export function createAsyncOrkaController(path: string): Type<unknown> {
  @Controller(path)
  class AsyncOrkaController {
    constructor(
      @Inject(ORKA_AGENTS_MAP) private readonly agents: Record<string, BaseAgent>,
    ) {}

    @Get()
    listAgents(): object {
      const agents = Object.entries(this.agents).map(([name, agent]) => ({
        name,
        goal: (agent as GoalAgent).goal,
        streaming: typeof (agent as StreamableAgent).runStream === 'function',
      }));
      return { agents, version: ORKA_VERSION };
    }

    @Get(':agent')
    getAgent(@Param('agent') name: string): object {
      const agent = this.agents[name];
      if (!agent) {
        throw new HttpException(
          { error: `Agent "${name}" not found`, available: Object.keys(this.agents) },
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        name,
        goal: (agent as GoalAgent).goal,
        streaming: typeof (agent as StreamableAgent).runStream === 'function',
      };
    }

    @Post(':agent')
    async runAgent(
      @Param('agent') name: string,
      @Body() body: AgentRunRequest,
    ): Promise<AgentRunResponse> {
      const agent = this.agents[name];
      if (!agent) {
        throw new HttpException({ error: `Agent "${name}" not found` }, HttpStatus.NOT_FOUND);
      }
      if (!body?.input) {
        throw new HttpException(
          { error: 'Request body must include "input" field' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const result = await agent.run(body.input);
      return {
        output: result.output,
        toolsUsed: result.toolsUsed,
        totalLatencyMs: result.totalLatencyMs,
        totalTokens: result.totalTokens,
        metadata: result.metadata,
      };
    }

    @Post(':agent/stream')
    async streamAgent(
      @Param('agent') name: string,
      @Body() body: AgentRunRequest,
      @Res() res: { setHeader(k: string, v: string): void; write(chunk: string): void; end(): void },
    ): Promise<void> {
      const agent = this.agents[name] as StreamableAgent | undefined;
      if (!agent) {
        throw new HttpException({ error: `Agent "${name}" not found` }, HttpStatus.NOT_FOUND);
      }
      if (typeof agent.runStream !== 'function') {
        throw new HttpException(
          { error: `Agent "${name}" does not support streaming` },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!body?.input) {
        throw new HttpException(
          { error: 'Request body must include "input" field' },
          HttpStatus.BAD_REQUEST,
        );
      }

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
    }
  }

  return AsyncOrkaController;
}
