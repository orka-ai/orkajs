import { describe, it, expect, vi } from 'vitest';
import { FallbackLLM } from '@orka-js/resilience';
import type { LLMAdapter, LLMResult } from '@orka-js/core';

const mockResult = (name: string): LLMResult => ({
  content: `response from ${name}`,
  usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
  model: name,
  finishReason: 'stop',
});

const createAdapter = (name: string, shouldFail = false): LLMAdapter => ({
  name,
  generate: vi.fn().mockImplementation(() =>
    shouldFail ? Promise.reject(new Error(`${name} failed`)) : Promise.resolve(mockResult(name)),
  ),
  embed: vi.fn().mockImplementation(() =>
    shouldFail ? Promise.reject(new Error(`${name} embed failed`)) : Promise.resolve([[0.1, 0.2]]),
  ),
});

describe('FallbackLLM', () => {
  it('throws when constructed with empty adapters array', () => {
    expect(() => new FallbackLLM({ adapters: [] })).toThrow('FallbackLLM requires at least one adapter');
  });

  describe('generate()', () => {
    it('returns result from first adapter when it succeeds', async () => {
      const a = createAdapter('primary');
      const b = createAdapter('secondary');
      const llm = new FallbackLLM({ adapters: [a, b] });
      const result = await llm.generate('prompt');
      expect(result.content).toBe('response from primary');
      expect(b.generate).not.toHaveBeenCalled();
    });

    it('falls back to second adapter when first fails', async () => {
      const a = createAdapter('primary', true);
      const b = createAdapter('secondary');
      const llm = new FallbackLLM({ adapters: [a, b] });
      const result = await llm.generate('prompt');
      expect(result.content).toBe('response from secondary');
    });

    it('calls onFallback when falling back', async () => {
      const onFallback = vi.fn();
      const a = createAdapter('primary', true);
      const b = createAdapter('secondary');
      const llm = new FallbackLLM({ adapters: [a, b], onFallback });
      await llm.generate('prompt');
      expect(onFallback).toHaveBeenCalledWith(
        expect.any(Error),
        'primary',
        'secondary',
      );
    });

    it('throws with all adapter names when all fail', async () => {
      const a = createAdapter('primary', true);
      const b = createAdapter('secondary', true);
      const llm = new FallbackLLM({ adapters: [a, b] });
      await expect(llm.generate('prompt')).rejects.toThrow(/All LLM adapters failed/);
    });

    it('includes tried adapter names in error message', async () => {
      const a = createAdapter('gpt-4', true);
      const b = createAdapter('claude', true);
      const llm = new FallbackLLM({ adapters: [a, b] });
      await expect(llm.generate('prompt')).rejects.toThrow(/gpt-4/);
    });
  });

  describe('embed()', () => {
    it('falls back to second adapter when first embed fails', async () => {
      const a = createAdapter('primary', true);
      const b = createAdapter('secondary');
      const llm = new FallbackLLM({ adapters: [a, b] });
      const result = await llm.embed('text');
      expect(result).toEqual([[0.1, 0.2]]);
    });

    it('throws when all embed adapters fail', async () => {
      const a = createAdapter('primary', true);
      const b = createAdapter('secondary', true);
      const llm = new FallbackLLM({ adapters: [a, b] });
      await expect(llm.embed('text')).rejects.toThrow(/All embedding adapters failed/);
    });
  });

  describe('name', () => {
    it('is always "fallback"', () => {
      const llm = new FallbackLLM({ adapters: [createAdapter('primary')] });
      expect(llm.name).toBe('fallback');
    });
  });
});
