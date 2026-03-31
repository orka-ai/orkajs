import { describe, it, expect, vi } from 'vitest';
import {
  cosineSimilarity,
  contextPrecision,
  contextRecall,
  answerRelevance,
  semanticSimilarity,
} from '@orka-js/evaluation';
import type { LLMAdapter } from '@orka-js/core';

// ─── mock LLM ─────────────────────────────────────────────────────────────────

function makeLLM(score: number, embedVector: number[] = [1, 0, 0]): LLMAdapter {
  return {
    name: 'mock',
    generate: vi.fn().mockResolvedValue({
      content: String(score),
      usage: { promptTokens: 5, completionTokens: 1, totalTokens: 6 },
      model: 'mock',
      finishReason: 'stop',
    }),
    embed: vi.fn().mockResolvedValue([embedVector]),
  };
}

// ─── cosineSimilarity ─────────────────────────────────────────────────────────

describe('cosineSimilarity()', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for zero vector', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

// ─── contextPrecision ─────────────────────────────────────────────────────────

describe('contextPrecision()', () => {
  it('returns score from LLM judge', async () => {
    const llm = makeLLM(0.8);
    const result = await contextPrecision({
      input: 'Who invented the telephone?',
      output: 'Alexander Graham Bell',
      context: ['Bell invented the telephone in 1876.', 'Unrelated text.'],
      llm,
    });
    expect(result.name).toBe('context_precision');
    expect(result.score).toBeCloseTo(0.8);
    expect(llm.generate).toHaveBeenCalledOnce();
  });

  it('returns 0 when no context provided', async () => {
    const llm = makeLLM(0.9);
    const result = await contextPrecision({ input: 'Q', output: 'A', llm });
    expect(result.score).toBe(0);
    expect(llm.generate).not.toHaveBeenCalled();
  });

  it('clamps score to [0, 1]', async () => {
    const llm = makeLLM(1.5); // out of range
    const result = await contextPrecision({ input: 'Q', output: 'A', context: ['ctx'], llm });
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ─── contextRecall ────────────────────────────────────────────────────────────

describe('contextRecall()', () => {
  it('returns score from LLM judge', async () => {
    const llm = makeLLM(0.7);
    const result = await contextRecall({
      input: 'Q',
      output: 'A',
      expectedOutput: 'Expected answer',
      context: ['Some relevant context.'],
      llm,
    });
    expect(result.name).toBe('context_recall');
    expect(result.score).toBeCloseTo(0.7);
  });

  it('returns 0 when no expectedOutput', async () => {
    const llm = makeLLM(0.9);
    const result = await contextRecall({ input: 'Q', output: 'A', context: ['ctx'], llm });
    expect(result.score).toBe(0);
    expect(result.details?.reason).toContain('expected');
  });

  it('returns 0 when no context', async () => {
    const llm = makeLLM(0.9);
    const result = await contextRecall({ input: 'Q', output: 'A', expectedOutput: 'E', llm });
    expect(result.score).toBe(0);
  });
});

// ─── answerRelevance ──────────────────────────────────────────────────────────

describe('answerRelevance()', () => {
  it('returns cosine similarity between question and answer embeddings', async () => {
    // Identical vectors → similarity = 1
    const llm = makeLLM(0, [0.6, 0.8]);
    const result = await answerRelevance({ input: 'Q', output: 'A', llm });
    expect(result.name).toBe('answer_relevance');
    expect(result.score).toBeCloseTo(1); // same vector → cos sim = 1
    expect(llm.embed).toHaveBeenCalledTimes(2);
    expect(llm.generate).not.toHaveBeenCalled();
  });

  it('returns low score for orthogonal embeddings', async () => {
    const llm: LLMAdapter = {
      name: 'mock',
      generate: vi.fn(),
      embed: vi.fn()
        .mockResolvedValueOnce([[1, 0]])  // question
        .mockResolvedValueOnce([[0, 1]]), // answer (orthogonal)
    };
    const result = await answerRelevance({ input: 'Q', output: 'A', llm });
    expect(result.score).toBeCloseTo(0);
  });
});

// ─── semanticSimilarity ───────────────────────────────────────────────────────

describe('semanticSimilarity()', () => {
  it('returns cosine similarity between output and expectedOutput', async () => {
    const llm = makeLLM(0, [0.5, 0.5]);
    const result = await semanticSimilarity({ input: 'Q', output: 'A', expectedOutput: 'A', llm });
    expect(result.name).toBe('semantic_similarity');
    expect(result.score).toBeCloseTo(1);
  });

  it('returns 0 when no expectedOutput', async () => {
    const llm = makeLLM(0);
    const result = await semanticSimilarity({ input: 'Q', output: 'A', llm });
    expect(result.score).toBe(0);
    expect(result.details?.reason).toContain('expected');
  });
});
