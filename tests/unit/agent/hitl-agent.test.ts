import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HITLAgent, MemoryCheckpointStore } from '@orka-js/agent';
import type { InterruptRequest, InterruptResponse, HITLConfig, Tool } from '@orka-js/agent';
import type { LLMAdapter, LLMResult } from '@orka-js/core';

const createMockLLM = (): LLMAdapter => ({
  name: 'mock-llm',
  generate: vi.fn().mockResolvedValue({
    content: 'Action: finish\nAction Input: {"answer": "Done"}',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    model: 'mock-model',
    finishReason: 'stop',
  } as LLMResult),
  embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
});

const createMockTool = (name: string): Tool => ({
  name,
  description: `Mock ${name} tool`,
  parameters: [{ name: 'input', type: 'string', description: 'Input', required: true }],
  execute: vi.fn().mockResolvedValue({ output: `${name} result` }),
});

describe('HITLAgent', () => {
  let mockLLM: LLMAdapter;
  let checkpointStore: MemoryCheckpointStore;

  beforeEach(() => {
    mockLLM = createMockLLM();
    checkpointStore = new MemoryCheckpointStore();
  });

  describe('constructor', () => {
    it('should create an agent with HITL config', () => {
      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [createMockTool('test')],
          hitl: {
            requireApprovalFor: ['test'],
          },
        },
        mockLLM
      );

      expect(agent).toBeDefined();
    });

    it('should accept checkpoint store', () => {
      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [],
          hitl: {
            checkpointStore,
          },
        },
        mockLLM
      );

      expect(agent).toBeDefined();
    });
  });

  describe('tool approval', () => {
    it('should require approval for specified tools', async () => {
      const onInterrupt = vi.fn().mockResolvedValue({
        id: 'test-id',
        status: 'approved',
        respondedAt: new Date(),
      } as InterruptResponse);

      const tool = createMockTool('sensitive_action');

      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [tool],
          maxSteps: 1,
          hitl: {
            requireApprovalFor: ['sensitive_action'],
            onInterrupt,
          },
        },
        mockLLM
      );

      (mockLLM.generate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: 'Thought: I need to do something\nAction: sensitive_action\nAction Input: {"input": "test"}',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'mock-model',
        finishReason: 'stop',
      });

      await agent.run('Do something sensitive');

      expect(onInterrupt).toHaveBeenCalled();
      const call = onInterrupt.mock.calls[0][0] as InterruptRequest;
      expect(call.reason).toBe('tool_approval');
      expect(call.data.toolName).toBe('sensitive_action');
    });

    it('should auto-approve tools in autoApproveTools list', async () => {
      const onInterrupt = vi.fn();
      const tool = createMockTool('safe_action');

      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [tool],
          maxSteps: 1,
          hitl: {
            requireApprovalFor: ['*'],
            autoApproveTools: ['safe_action'],
            onInterrupt,
          },
        },
        mockLLM
      );

      (mockLLM.generate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: 'Thought: I need to do something\nAction: safe_action\nAction Input: {"input": "test"}',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'mock-model',
        finishReason: 'stop',
      });

      await agent.run('Do something safe');

      expect(onInterrupt).not.toHaveBeenCalled();
    });

    it('should handle rejected tool approval', async () => {
      const onInterrupt = vi.fn().mockResolvedValue({
        id: 'test-id',
        status: 'rejected',
        feedback: 'Not allowed',
        respondedAt: new Date(),
      } as InterruptResponse);

      const tool = createMockTool('dangerous_action');

      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [tool],
          maxSteps: 2,
          hitl: {
            requireApprovalFor: ['dangerous_action'],
            onInterrupt,
          },
        },
        mockLLM
      );

      (mockLLM.generate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          content: 'Thought: I need to do something\nAction: dangerous_action\nAction Input: {"input": "test"}',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'mock-model',
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Action: finish\nAction Input: {"answer": "Aborted"}',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'mock-model',
          finishReason: 'stop',
        });

      const result = await agent.run('Do something dangerous');

      expect(result.wasInterrupted).toBe(true);
      expect(result.interrupts).toHaveLength(1);
      expect(result.interrupts[0].status).toBe('rejected');
    });

    it('should handle modified tool input', async () => {
      const onInterrupt = vi.fn().mockResolvedValue({
        id: 'test-id',
        status: 'modified',
        modifiedData: {
          toolInput: { input: 'modified value' },
        },
        respondedAt: new Date(),
      } as InterruptResponse);

      const tool = createMockTool('modifiable_action');

      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [tool],
          maxSteps: 1,
          hitl: {
            requireApprovalFor: ['modifiable_action'],
            onInterrupt,
          },
        },
        mockLLM
      );

      (mockLLM.generate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: 'Thought: I need to do something\nAction: modifiable_action\nAction Input: {"input": "original"}',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'mock-model',
        finishReason: 'stop',
      });

      await agent.run('Do something');

      expect(tool.execute).toHaveBeenCalledWith({ input: 'modified value' });
    });
  });

  describe('checkpoints', () => {
    it('should create checkpoints at specified intervals', async () => {
      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [createMockTool('action')],
          maxSteps: 5,
          hitl: {
            checkpointEvery: 2,
            checkpointStore,
          },
        },
        mockLLM
      );

      (mockLLM.generate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          content: 'Thought: Step 1\nAction: action\nAction Input: {"input": "1"}',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'mock-model',
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Thought: Step 2\nAction: action\nAction Input: {"input": "2"}',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'mock-model',
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Action: finish\nAction Input: {"answer": "Done"}',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'mock-model',
          finishReason: 'stop',
        });

      const result = await agent.run('Do multiple steps');

      expect(result.checkpoints.length).toBeGreaterThan(0);
    });

    it('should be able to list checkpoints', async () => {
      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [],
          hitl: {
            checkpointEvery: 1,
            checkpointStore,
          },
        },
        mockLLM
      );

      await agent.run('Test');

      const checkpoints = await agent.getCheckpoints();
      expect(Array.isArray(checkpoints)).toBe(true);
    });
  });

  describe('result structure', () => {
    it('should return HITLAgentResult with correct fields', async () => {
      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [],
          hitl: {},
        },
        mockLLM
      );

      const result = await agent.run('Test');

      expect(result).toHaveProperty('interrupts');
      expect(result).toHaveProperty('checkpoints');
      expect(result).toHaveProperty('wasInterrupted');
      expect(Array.isArray(result.interrupts)).toBe(true);
      expect(Array.isArray(result.checkpoints)).toBe(true);
      expect(typeof result.wasInterrupted).toBe('boolean');
    });
  });

  describe('requestConfirmation', () => {
    it('should trigger an interrupt with confirmation reason', async () => {
      const onInterrupt = vi.fn().mockResolvedValue({
        id: 'confirm-id',
        status: 'approved',
        respondedAt: new Date(),
      } as InterruptResponse);

      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [],
          hitl: {
            onInterrupt,
          },
        },
        mockLLM
      );

      const response = await agent.requestConfirmation('Are you sure?', { extra: 'data' });

      expect(onInterrupt).toHaveBeenCalled();
      const call = onInterrupt.mock.calls[0][0] as InterruptRequest;
      expect(call.reason).toBe('confirmation');
      expect(call.message).toBe('Are you sure?');
      expect(response.status).toBe('approved');
    });
  });

  describe('requestReview', () => {
    it('should trigger an interrupt with review reason', async () => {
      const onInterrupt = vi.fn().mockResolvedValue({
        id: 'review-id',
        status: 'approved',
        respondedAt: new Date(),
      } as InterruptResponse);

      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [],
          hitl: {
            onInterrupt,
          },
        },
        mockLLM
      );

      const response = await agent.requestReview('Please review', 5, 'My reasoning');

      expect(onInterrupt).toHaveBeenCalled();
      const call = onInterrupt.mock.calls[0][0] as InterruptRequest;
      expect(call.reason).toBe('review');
      expect(call.data.stepNumber).toBe(5);
      expect(call.data.thought).toBe('My reasoning');
      expect(response.status).toBe('approved');
    });
  });

  describe('events', () => {
    it('should emit events during execution', async () => {
      const agent = new HITLAgent(
        {
          goal: 'Test goal',
          tools: [],
          hitl: {},
        },
        mockLLM
      );

      const events: string[] = [];
      agent.on('step:start', () => events.push('step:start'));
      agent.on('complete', () => events.push('complete'));

      await agent.run('Test');

      expect(events).toContain('complete');
    });
  });
});
