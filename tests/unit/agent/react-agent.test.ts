import { describe, it, expect, vi } from 'vitest';
import { ReActAgent } from '@orka-js/agent';
import type { LLMAdapter } from '@orka-js/core';

const mockUsage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };

const createMockLLM = (responses: string[]): LLMAdapter => {
  let callIndex = 0;
  return {
    name: 'mock',
    generate: vi.fn().mockImplementation(() => {
      const content = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return Promise.resolve({ content, usage: mockUsage, model: 'mock', finishReason: 'stop' });
    }),
    embed: vi.fn().mockResolvedValue([[0.1]]),
  };
};

const reactResponse = (thought: string, action: string, input: object): string =>
  `Thought: ${thought}\nAction: ${action}\nAction Input: ${JSON.stringify(input)}`;

const finishResponse = (answer: string): string =>
  reactResponse('I have the answer.', 'finish', { answer });

describe('ReActAgent', () => {
  describe('run()', () => {
    it('returns AgentResult on finish in step 1', async () => {
      const llm = createMockLLM([finishResponse('The answer is 42.')]);
      const agent = new ReActAgent({ goal: 'Answer questions', tools: [] }, llm);
      const result = await agent.run('What is the answer?');
      expect(result.output).toBe('The answer is 42.');
      expect(result.steps).toHaveLength(0);
    });

    it('executes a tool and then finishes', async () => {
      const calcTool = {
        name: 'calculator',
        description: 'Performs math',
        parameters: [{ name: 'expression', type: 'string', description: 'Math expression' }],
        execute: vi.fn().mockResolvedValue('42'),
      };
      const llm = createMockLLM([
        reactResponse('I need to calculate.', 'calculator', { expression: '6 * 7' }),
        finishResponse('The result is 42.'),
      ]);
      const agent = new ReActAgent({ goal: 'Calculate things', tools: [calcTool] }, llm);
      const result = await agent.run('What is 6*7?');
      expect(calcTool.execute).toHaveBeenCalled();
      expect(result.output).toBe('The result is 42.');
      expect(result.steps.length).toBeGreaterThanOrEqual(1);
    });

    it('returns a fallback when max steps is reached', async () => {
      const neverFinish = reactResponse('Still thinking...', 'calculator', { expression: '1+1' });
      const calcTool = {
        name: 'calculator',
        description: 'Math',
        parameters: [{ name: 'expression', type: 'string', description: 'Expression' }],
        execute: vi.fn().mockResolvedValue('2'),
      };
      const llm = createMockLLM(Array(10).fill(neverFinish));
      const agent = new ReActAgent({ goal: 'Loop', tools: [calcTool], maxSteps: 3 }, llm);
      const result = await agent.run('Loop forever');
      expect(result.metadata?.maxStepsReached).toBe(true);
      expect(result.steps.length).toBe(3);
    });

    it('records observation error when tool is not found', async () => {
      const llm = createMockLLM([
        reactResponse('Try unknown tool.', 'nonexistent_tool', {}),
        finishResponse('Done despite error.'),
      ]);
      const agent = new ReActAgent({ goal: 'Test', tools: [] }, llm);
      const result = await agent.run('Use an unknown tool');
      expect(result.steps[0].observation).toContain('nonexistent_tool');
      expect(result.output).toBe('Done despite error.');
    });
  });
});
