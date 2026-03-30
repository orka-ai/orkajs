import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from '@orka-js/agent';
import type { AgentResult, AgentStepResult, Tool } from '@orka-js/agent';
import type { LLMAdapter, LLMResult } from '@orka-js/core';

// ── Minimal concrete subclass to test BaseAgent ───────────────────────────────
class TestAgent extends BaseAgent {
  async run(input: string): Promise<AgentResult> {
    this.startRun();
    this.emit({ type: 'step:start', agentType: 'test', step: 1, input });
    const result = this.buildResult(input, 'test output', [] as AgentStepResult[], Date.now(), {});
    this.emit({ type: 'complete', agentType: 'test', output: result.output });
    return result;
  }

  // Expose protected methods for testing
  public testExecuteTool(name: string, input: Record<string, unknown>) {
    return this.executeTool(name, input);
  }
  public testEmit(event: Parameters<BaseAgent['emit']>[0]) {
    return this.emit(event);
  }
  public testIsToolBlocked(name: string) {
    return this.isToolBlocked(name);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const createMockLLM = (): LLMAdapter => ({
  name: 'mock-llm',
  generate: vi.fn().mockResolvedValue({
    content: 'Thought: done\nAction: final_answer\nAction Input: {"answer": "ok"}',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    model: 'mock',
    finishReason: 'stop',
  } as LLMResult),
  embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
});

const createTool = (name: string, handler?: () => Promise<string>): Tool => ({
  name,
  description: `${name} tool`,
  execute: vi.fn().mockImplementation(async () => ({
    output: handler ? await handler() : `${name} result`,
  })),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BaseAgent', () => {
  let mockLLM: LLMAdapter;

  beforeEach(() => {
    mockLLM = createMockLLM();
    vi.clearAllMocks();
  });

  // ── Fix 1: Silent failure logging ──────────────────────────────────────────
  describe('emit() — listener error isolation', () => {
    it('should not propagate errors thrown by listeners', async () => {
      const agent = new TestAgent({ goal: 'test', tools: [] }, mockLLM);
      agent.on('complete', () => {
        throw new Error('listener crash');
      });

      await expect(agent.run('hello')).resolves.toBeDefined();
    });

    it('should log a warning when a listener throws', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const agent = new TestAgent({ goal: 'test', tools: [] }, mockLLM);
      agent.on('complete', () => {
        throw new Error('boom');
      });

      await agent.run('hello');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OrkaJS]'),
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });

    it('should still call subsequent listeners when one throws', () => {
      const agent = new TestAgent({ goal: 'test', tools: [] }, mockLLM);
      const secondListener = vi.fn();

      agent.on('step:start', () => {
        throw new Error('first crashes');
      });
      agent.on('step:start', secondListener);

      // Suppress the warning noise in this test
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      agent.testEmit({ type: 'step:start', agentType: 'test', step: 1 });

      expect(secondListener).toHaveBeenCalledOnce();
    });
  });

  // ── on / off ───────────────────────────────────────────────────────────────
  describe('on() and off()', () => {
    it('should register and call listeners', async () => {
      const agent = new TestAgent({ goal: 'test', tools: [] }, mockLLM);
      const listener = vi.fn();
      agent.on('complete', listener);

      await agent.run('test');

      expect(listener).toHaveBeenCalledOnce();
    });

    it('should remove listeners with off()', async () => {
      const agent = new TestAgent({ goal: 'test', tools: [] }, mockLLM);
      const listener = vi.fn();
      agent.on('complete', listener);
      agent.off('complete', listener);

      await agent.run('test');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple event types independently', () => {
      const agent = new TestAgent({ goal: 'test', tools: [] }, mockLLM);
      const stepListener = vi.fn();
      const completeListener = vi.fn();

      agent.on('step:start', stepListener);
      agent.on('complete', completeListener);

      agent.testEmit({ type: 'step:start', agentType: 'test', step: 1 });

      expect(stepListener).toHaveBeenCalledOnce();
      expect(completeListener).not.toHaveBeenCalled();
    });
  });

  // ── executeTool ───────────────────────────────────────────────────────────
  describe('executeTool()', () => {
    it('should execute a tool and return its output', async () => {
      const tool = createTool('calculator');
      const agent = new TestAgent({ goal: 'test', tools: [tool] }, mockLLM);

      const result = await agent.testExecuteTool('calculator', { x: 1 });

      expect(result).toBe('calculator result');
    });

    it('should return an error string when tool is not found (not throw)', async () => {
      const agent = new TestAgent({ goal: 'test', tools: [] }, mockLLM);

      const result = await agent.testExecuteTool('unknown_tool', {});

      expect(result).toContain('unknown_tool');
      expect(result.toLowerCase()).toContain('not found');
    });

    it('should return an error string when the tool execution throws (not propagate)', async () => {
      const failingTool: Tool = {
        name: 'broken',
        description: 'always fails',
        execute: vi.fn().mockRejectedValue(new Error('tool internal error')),
      };
      const agent = new TestAgent({ goal: 'test', tools: [failingTool] }, mockLLM);

      const result = await agent.testExecuteTool('broken', {});

      expect(result).toContain('tool internal error');
    });

    it('should emit tool:start and tool:end events on success', async () => {
      const tool = createTool('search');
      const agent = new TestAgent({ goal: 'test', tools: [tool] }, mockLLM);
      const startListener = vi.fn();
      const endListener = vi.fn();
      agent.on('tool:start', startListener);
      agent.on('tool:end', endListener);

      await agent.testExecuteTool('search', { query: 'test' });

      expect(startListener).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'search' }));
      expect(endListener).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'search' }));
    });

    it('should emit tool:error event when tool throws', async () => {
      const failingTool: Tool = {
        name: 'broken',
        description: 'always fails',
        execute: vi.fn().mockRejectedValue(new Error('boom')),
      };
      const agent = new TestAgent({ goal: 'test', tools: [failingTool] }, mockLLM);
      const errorListener = vi.fn();
      agent.on('tool:error', errorListener);

      await agent.testExecuteTool('broken', {});

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tool:error', toolName: 'broken' }),
      );
    });

    it('should return blocked message when tool is in blockedTools policy', async () => {
      const tool = createTool('dangerous');
      const agent = new TestAgent(
        { goal: 'test', tools: [tool], policy: { blockedTools: ['dangerous'] } },
        mockLLM,
      );

      const result = await agent.testExecuteTool('dangerous', {});

      expect(result.toLowerCase()).toContain('blocked');
    });

    it('should return blocked message when tool is not in allowedTools policy', async () => {
      const tool = createTool('unauthorized');
      const agent = new TestAgent(
        { goal: 'test', tools: [tool], policy: { allowedTools: ['other_tool'] } },
        mockLLM,
      );

      const result = await agent.testExecuteTool('unauthorized', {});

      expect(result.toLowerCase()).toContain('blocked');
    });
  });

  // ── buildResult ────────────────────────────────────────────────────────────
  describe('buildResult()', () => {
    it('should return a valid AgentResult shape', async () => {
      const agent = new TestAgent({ goal: 'test', tools: [] }, mockLLM);
      const result = await agent.run('what is 2+2?');

      expect(result).toMatchObject({
        input: 'what is 2+2?',
        output: expect.any(String),
        steps: expect.any(Array),
        totalLatencyMs: expect.any(Number),
        totalTokens: expect.any(Number),
        toolsUsed: expect.any(Array),
        metadata: expect.objectContaining({ agentType: expect.any(String) }),
      });
    });
  });
});
