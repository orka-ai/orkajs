import { describe, it, expect, vi } from 'vitest';
import { BudgetedLLM, BudgetExceededError } from '../budget.js';
import type { LLMAdapter, LLMResult } from '@orka-js/core';

// Simple mock adapter
function createMockAdapter(cost = 0.01, tokens = 100): LLMAdapter {
  return {
    name: 'mock',
    async generate(): Promise<LLMResult> {
      return {
        content: 'Hello',
        usage: { promptTokens: tokens / 2, completionTokens: tokens / 2, totalTokens: tokens },
        model: 'mock',
        finishReason: 'stop',
        cost,
      };
    },
    async generateObject() { return {} as never; },
    async embed() { return [[0.1, 0.2]]; },
  };
}

describe('BudgetedLLM', () => {
  it('passes through successful calls', async () => {
    const llm = new BudgetedLLM(createMockAdapter(), { maxTotalCost: 1.0 });
    const result = await llm.generate('Hello');
    expect(result.content).toBe('Hello');
  });

  it('tracks token usage across calls', async () => {
    const llm = new BudgetedLLM(createMockAdapter(0.01, 100), {});
    await llm.generate('call 1');
    await llm.generate('call 2');
    const state = llm.getState();
    expect(state.totalTokensUsed).toBe(200);
    expect(state.callCount).toBe(2);
  });

  it('throws when total cost exceeded', async () => {
    const llm = new BudgetedLLM(createMockAdapter(0.05), { maxTotalCost: 0.08 });
    await llm.generate('call 1'); // costs 0.05
    await llm.generate('call 2'); // costs 0.05 → total 0.10 > 0.08
    await expect(llm.generate('call 3')).rejects.toThrow(BudgetExceededError);
  });

  it('throws when total tokens exceeded', async () => {
    const llm = new BudgetedLLM(createMockAdapter(0, 100), { maxTotalTokens: 150 });
    await llm.generate('call 1'); // 100 tokens
    await expect(llm.generate('call 2')).rejects.toThrow(BudgetExceededError);
  });

  it('getRemainingBudget returns correct values', async () => {
    const llm = new BudgetedLLM(createMockAdapter(0.01, 100), {
      maxTotalCost: 0.10,
      maxTotalTokens: 500,
    });
    await llm.generate('call 1');
    const remaining = llm.getRemainingBudget();
    expect(remaining.totalCost).toBeCloseTo(0.09);
    expect(remaining.totalTokens).toBe(400);
  });

  it('calls onWarning when approaching 90% of budget', async () => {
    const onWarning = vi.fn();
    const llm = new BudgetedLLM(createMockAdapter(0.09), {
      maxTotalCost: 0.10,
      onWarning,
    });
    await llm.generate('call 1'); // 0.09/0.10 = 90%
    expect(onWarning).toHaveBeenCalled();
  });

  it('reset clears all usage', async () => {
    const llm = new BudgetedLLM(createMockAdapter(0.01, 100), {});
    await llm.generate('call 1');
    llm.reset();
    const state = llm.getState();
    expect(state.totalTokensUsed).toBe(0);
    expect(state.totalCostUsed).toBe(0);
  });
});
