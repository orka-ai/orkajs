import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsensusLLM } from '@orka-js/orchestration';
import { OrkaError, OrkaErrorCode } from '@orka-js/core';
import type { LLMAdapter, LLMResult } from '@orka-js/core';

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockResult = (content: string): LLMResult => ({
  content,
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  model: 'mock-model',
  finishReason: 'stop',
});

const createAdapter = (name: string, response: string): LLMAdapter => ({
  name,
  generate: vi.fn().mockResolvedValue(mockResult(response)),
  embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
});

const createFailingAdapter = (name: string, message = 'API error'): LLMAdapter => ({
  name,
  generate: vi.fn().mockRejectedValue(new Error(message)),
  embed: vi.fn().mockRejectedValue(new Error(message)),
});

// A judge adapter that always returns a predictable score/selection
const createJudgeAdapter = (response: string): LLMAdapter => ({
  name: 'judge',
  generate: vi.fn().mockResolvedValue(mockResult(response)),
  embed: vi.fn().mockResolvedValue([[0, 0]]),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('ConsensusLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Constructor ───────────────────────────────────────────────────────────
  describe('constructor', () => {
    it('should throw OrkaError(INVALID_CONFIG) with less than 2 adapters', () => {
      expect(() =>
        new ConsensusLLM({ adapters: [createAdapter('a', 'hello')], strategy: 'majority' })
      ).toThrow(OrkaError);
    });

    it('should include INVALID_CONFIG code and adapter count in metadata', () => {
      try {
        new ConsensusLLM({ adapters: [createAdapter('a', 'hi')], strategy: 'majority' });
      } catch (err) {
        expect(err).toBeInstanceOf(OrkaError);
        expect((err as OrkaError).code).toBe(OrkaErrorCode.INVALID_CONFIG);
        expect((err as OrkaError).module).toBe('ConsensusLLM');
        expect((err as OrkaError).metadata?.provided).toBe(1);
      }
    });

    it('should accept 2 or more adapters', () => {
      expect(() =>
        new ConsensusLLM({
          adapters: [createAdapter('a', 'hi'), createAdapter('b', 'hello')],
          strategy: 'majority',
        })
      ).not.toThrow();
    });
  });

  // ── All adapters fail ─────────────────────────────────────────────────────
  describe('generate() — all adapters fail', () => {
    it('should throw OrkaError(LLM_API_ERROR) when all adapters fail', async () => {
      const consensus = new ConsensusLLM({
        adapters: [createFailingAdapter('a', 'err-a'), createFailingAdapter('b', 'err-b')],
        strategy: 'majority',
      });

      await expect(consensus.generate('test')).rejects.toThrow(OrkaError);
    });

    it('should include failure details in metadata', async () => {
      const consensus = new ConsensusLLM({
        adapters: [createFailingAdapter('gpt', 'rate limit'), createFailingAdapter('claude', 'timeout')],
        strategy: 'majority',
      });

      try {
        await consensus.generate('test');
      } catch (err) {
        expect(err).toBeInstanceOf(OrkaError);
        expect((err as OrkaError).code).toBe(OrkaErrorCode.LLM_API_ERROR);
        expect((err as OrkaError).module).toBe('ConsensusLLM');

        const failures = (err as OrkaError).metadata?.failures as Array<{ adapter: string; error: string }>;
        expect(failures).toHaveLength(2);
        expect(failures.some(f => f.adapter === 'gpt')).toBe(true);
        expect(failures.some(f => f.adapter === 'claude')).toBe(true);
        expect(failures.find(f => f.adapter === 'gpt')?.error).toBe('rate limit');
      }
    });
  });

  // ── Partial failure ───────────────────────────────────────────────────────
  describe('generate() — partial failure (1 fails, 1 succeeds)', () => {
    it('should succeed using the valid adapter response', async () => {
      const judge = createJudgeAdapter('1'); // picks first response
      const consensus = new ConsensusLLM({
        adapters: [createAdapter('working', 'The answer is 42'), createFailingAdapter('broken')],
        strategy: 'majority',
        judge,
      });

      const result = await consensus.generate('test');

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  // ── majority strategy ─────────────────────────────────────────────────────
  describe('generate() — majority strategy', () => {
    it('should return a valid ConsensusResult shape', async () => {
      const judge = createJudgeAdapter('1');
      const consensus = new ConsensusLLM({
        adapters: [createAdapter('a', 'Paris'), createAdapter('b', 'Paris')],
        strategy: 'majority',
        judge,
      });

      const result = await consensus.generate('What is the capital of France?');

      expect(result).toMatchObject({
        content: expect.any(String),
        selectedAdapter: expect.any(String),
        responses: expect.any(Array),
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          totalTokens: expect.any(Number),
        }),
      });
    });

    it('should aggregate token usage from all adapters', async () => {
      const judge = createJudgeAdapter('1');
      const consensus = new ConsensusLLM({
        adapters: [createAdapter('a', 'r1'), createAdapter('b', 'r2')],
        strategy: 'majority',
        judge,
      });

      const result = await consensus.generate('test');

      // Each adapter has usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      // Aggregated = 2x each
      expect(result.usage.totalTokens).toBe(30);
      expect(result.usage.promptTokens).toBe(20);
    });

    it('should include all adapter responses in result.responses', async () => {
      const judge = createJudgeAdapter('1');
      const consensus = new ConsensusLLM({
        adapters: [createAdapter('gpt', 'answer-gpt'), createAdapter('claude', 'answer-claude')],
        strategy: 'majority',
        judge,
      });

      const result = await consensus.generate('test');

      expect(result.responses).toHaveLength(2);
      expect(result.responses.some(r => r.adapter === 'gpt')).toBe(true);
      expect(result.responses.some(r => r.adapter === 'claude')).toBe(true);
    });
  });

  // ── best_score strategy ───────────────────────────────────────────────────
  describe('generate() — best_score strategy', () => {
    it('should select the adapter with the highest score', async () => {
      // Judge returns [0.3, 0.9] → second adapter wins
      const judge = createJudgeAdapter('[0.3, 0.9]');
      const consensus = new ConsensusLLM({
        adapters: [createAdapter('weak', 'mediocre answer'), createAdapter('strong', 'excellent answer')],
        strategy: 'best_score',
        judge,
      });

      const result = await consensus.generate('What is 2+2?');

      expect(result.selectedAdapter).toBe('strong');
      expect(result.content).toBe('excellent answer');
    });

    it('should include scores in responses', async () => {
      const judge = createJudgeAdapter('[0.4, 0.8]');
      const consensus = new ConsensusLLM({
        adapters: [createAdapter('a', 'ok'), createAdapter('b', 'great')],
        strategy: 'best_score',
        judge,
      });

      const result = await consensus.generate('test');

      expect(result.responses.every(r => typeof r.score === 'number')).toBe(true);
    });
  });

  // ── embed() ───────────────────────────────────────────────────────────────
  describe('embed()', () => {
    it('should delegate to the first adapter', async () => {
      const first = createAdapter('first', 'hi');
      const second = createAdapter('second', 'hi');
      const consensus = new ConsensusLLM({
        adapters: [first, second],
        strategy: 'majority',
      });

      await consensus.embed('hello');

      expect(first.embed).toHaveBeenCalledWith('hello');
      expect(second.embed).not.toHaveBeenCalled();
    });
  });
});
