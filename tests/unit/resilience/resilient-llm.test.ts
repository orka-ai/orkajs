import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResilientLLM } from '@orka-js/resilience';
import type { LLMAdapter, LLMResult } from '@orka-js/core';

const mockResult: LLMResult = {
  content: 'ok',
  usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
  model: 'mock',
  finishReason: 'stop',
};

const createMockLLM = (name = 'mock'): LLMAdapter => ({
  name,
  generate: vi.fn().mockResolvedValue(mockResult),
  embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
});

describe('ResilientLLM', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe('name', () => {
    it('prefixes the inner adapter name with "resilient-"', () => {
      const llm = new ResilientLLM({ llm: createMockLLM('gpt-4') });
      expect(llm.name).toBe('resilient-gpt-4');
    });
  });

  describe('generate()', () => {
    it('succeeds on first try without retrying', async () => {
      const inner = createMockLLM();
      const llm = new ResilientLLM({ llm: inner });
      const promise = llm.generate('prompt');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.content).toBe('ok');
      expect(inner.generate).toHaveBeenCalledTimes(1);
    });

    it('retries on rate limit error (retryable)', async () => {
      const inner = createMockLLM();
      (inner.generate as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockResolvedValue(mockResult);
      const llm = new ResilientLLM({ llm: inner });
      const promise = llm.generate('prompt');
      await vi.runAllTimersAsync();
      await promise;
      expect(inner.generate).toHaveBeenCalledTimes(2);
    });

    it('throws immediately on non-retryable error', async () => {
      const inner = createMockLLM();
      (inner.generate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('invalid API key'));
      const llm = new ResilientLLM({ llm: inner });
      const rejectCheck = expect(llm.generate('prompt')).rejects.toThrow('invalid API key');
      await vi.runAllTimersAsync();
      await rejectCheck;
      expect(inner.generate).toHaveBeenCalledTimes(1);
    });

    it('retries on timeout error', async () => {
      const inner = createMockLLM();
      (inner.generate as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('request timed out'))
        .mockResolvedValue(mockResult);
      const llm = new ResilientLLM({ llm: inner });
      const promise = llm.generate('prompt');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.content).toBe('ok');
    });
  });

  describe('embed()', () => {
    it('succeeds on first try', async () => {
      const inner = createMockLLM();
      const llm = new ResilientLLM({ llm: inner });
      const promise = llm.embed('text');
      await vi.runAllTimersAsync();
      await promise;
      expect(inner.embed).toHaveBeenCalledTimes(1);
    });

    it('retries on rate limit error', async () => {
      const inner = createMockLLM();
      (inner.embed as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('429 rate limit'))
        .mockResolvedValue([[0.1]]);
      const llm = new ResilientLLM({ llm: inner });
      const promise = llm.embed('text');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toEqual([[0.1]]);
    });
  });

  describe('getInnerLLM()', () => {
    it('returns the wrapped adapter', () => {
      const inner = createMockLLM('gpt-4');
      const llm = new ResilientLLM({ llm: inner });
      expect(llm.getInnerLLM()).toBe(inner);
    });
  });

  describe('custom retry options', () => {
    it('respects custom maxRetries', async () => {
      const inner = createMockLLM();
      (inner.generate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));
      const llm = new ResilientLLM({ llm: inner, retry: { maxRetries: 1, initialDelayMs: 10 } });
      const rejectCheck = expect(llm.generate('prompt')).rejects.toThrow();
      await vi.runAllTimersAsync();
      await rejectCheck;
      expect(inner.generate).toHaveBeenCalledTimes(2); // initial + 1 retry
    });
  });
});
