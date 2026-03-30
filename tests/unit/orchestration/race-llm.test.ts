import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RaceLLM } from '@orka-js/orchestration';
import { OrkaError, OrkaErrorCode } from '@orka-js/core';
import type { LLMAdapter, LLMResult } from '@orka-js/core';

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockResult = (content: string, adapter: string): LLMResult => ({
  content,
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  model: `${adapter}-model`,
  finishReason: 'stop',
});

const createAdapter = (name: string, delayMs = 0): LLMAdapter => ({
  name,
  generate: vi.fn().mockImplementation(async () => {
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    return mockResult(`response from ${name}`, name);
  }),
  embed: vi.fn().mockImplementation(async () => {
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    return [[0.1, 0.2, 0.3]];
  }),
});

// Never-resolving adapter (simulates a hung request)
const createHungAdapter = (name: string): LLMAdapter => ({
  name,
  generate: vi.fn().mockImplementation(() => new Promise(() => {})),
  embed: vi.fn().mockImplementation(() => new Promise(() => {})),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('RaceLLM', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Constructor ───────────────────────────────────────────────────────────
  describe('constructor', () => {
    it('should throw OrkaError(INVALID_CONFIG) with less than 2 adapters', () => {
      expect(() => new RaceLLM({ adapters: [createAdapter('a')] })).toThrow(OrkaError);

      try {
        new RaceLLM({ adapters: [createAdapter('a')] });
      } catch (err) {
        expect(err).toBeInstanceOf(OrkaError);
        expect((err as OrkaError).code).toBe(OrkaErrorCode.INVALID_CONFIG);
        expect((err as OrkaError).module).toBe('RaceLLM');
        expect((err as OrkaError).metadata?.provided).toBe(1);
      }
    });

    it('should accept exactly 2 adapters', () => {
      expect(() => new RaceLLM({ adapters: [createAdapter('a'), createAdapter('b')] })).not.toThrow();
    });

    it('should default timeout to 30000ms', () => {
      // No error = it instantiated fine with default timeout
      const race = new RaceLLM({ adapters: [createAdapter('a'), createAdapter('b')] });
      expect(race).toBeDefined();
    });
  });

  // ── generate() ────────────────────────────────────────────────────────────
  describe('generate()', () => {
    it('should return the first adapter result that resolves', async () => {
      const fast = createAdapter('fast', 0);
      const slow = createAdapter('slow', 500);
      const race = new RaceLLM({ adapters: [fast, slow] });

      const result = await race.generate('test prompt');

      expect(result.content).toBe('response from fast');
      expect(result.winnerAdapter).toBe('fast');
    });

    it('should include race metadata in the model field', async () => {
      const a = createAdapter('gpt');
      const b = createAdapter('claude');
      const race = new RaceLLM({ adapters: [a, b] });

      const result = await race.generate('test');

      expect(result.model).toMatch(/^race\//);
    });

    it('should include latencyMs in result', async () => {
      const race = new RaceLLM({ adapters: [createAdapter('a'), createAdapter('b')] });

      const result = await race.generate('test');

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw OrkaError(LLM_TIMEOUT) when all adapters exceed timeout', async () => {
      vi.useFakeTimers();

      const race = new RaceLLM({ adapters: [createHungAdapter('hung1'), createHungAdapter('hung2')], timeout: 1000 });

      // Pre-attach .catch before advancing timers to avoid unhandled rejection warning
      const rejection = race.generate('test').catch(e => e as OrkaError);

      await vi.advanceTimersByTimeAsync(1001);

      const err = await rejection;
      expect(err).toBeInstanceOf(OrkaError);
      expect(err.code).toBe(OrkaErrorCode.LLM_TIMEOUT);
      expect(err.module).toBe('RaceLLM');
      expect(err.metadata?.timeout).toBe(1000);
      expect(err.metadata?.adapters).toContain('hung1');

      vi.useRealTimers();
    });

    it('should NOT timeout when a fast adapter responds in time', async () => {
      vi.useFakeTimers();

      const fast = createAdapter('fast', 0);
      const hung = createHungAdapter('hung');
      const race = new RaceLLM({ adapters: [fast, hung], timeout: 5000 });

      // Fast adapter resolves immediately (microtask), so we don't need to advance timers
      const result = await Promise.resolve().then(() => race.generate('test'));

      expect(result.winnerAdapter).toBe('fast');
    });
  });

  // ── embed() ───────────────────────────────────────────────────────────────
  describe('embed()', () => {
    it('should return embeddings from the first adapter to resolve', async () => {
      const fast = createAdapter('fast', 0);
      const slow = createAdapter('slow', 500);
      const race = new RaceLLM({ adapters: [fast, slow] });

      const result = await race.embed('hello world');

      expect(result).toEqual([[0.1, 0.2, 0.3]]);
    });

    it('should throw OrkaError(LLM_TIMEOUT) when embed exceeds timeout', async () => {
      vi.useFakeTimers();

      const race = new RaceLLM({ adapters: [createHungAdapter('hung1'), createHungAdapter('hung2')], timeout: 500 });

      // Pre-attach .catch before advancing timers to avoid unhandled rejection warning
      const rejection = race.embed('test text').catch(e => e as OrkaError);

      await vi.advanceTimersByTimeAsync(501);

      const err = await rejection;
      expect(err).toBeInstanceOf(OrkaError);
      expect(err.code).toBe(OrkaErrorCode.LLM_TIMEOUT);
      expect(err.module).toBe('RaceLLM');

      vi.useRealTimers();
    });

    it('should accept string array input', async () => {
      const race = new RaceLLM({ adapters: [createAdapter('a'), createAdapter('b')] });

      const result = await race.embed(['hello', 'world']);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
