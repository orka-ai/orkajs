import type { LLMAdapter } from '@orka-js/core';
import type { MetricFn, MetricResult } from './metrics.js';

/**
 * Cosine similarity between two vectors (used by embedding-based RAGAS metrics).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Ask the LLM to return a score between 0 and 1, given a prompt.
 */
async function llmScore(llm: LLMAdapter, prompt: string, metricName: string): Promise<MetricResult> {
  const result = await llm.generate(prompt, { temperature: 0, maxTokens: 10 });
  const score = parseFloat(result.content.trim());
  return {
    name: metricName,
    score: isNaN(score) ? 0 : Math.min(1, Math.max(0, score)),
  };
}

/**
 * Context Precision — what fraction of retrieved contexts are actually useful?
 * Uses LLM as judge (0 = none useful, 1 = all useful).
 */
export const contextPrecision: MetricFn = async ({ input, output: _output, context, llm }) => {
  if (!context || context.length === 0) {
    return { name: 'context_precision', score: 0, details: { reason: 'no context provided' } };
  }

  const contextList = context.map((c, i) => `[${i + 1}] ${c}`).join('\n');
  const prompt = `You are an evaluation judge. Given the following question and retrieved context passages, rate what fraction of the contexts are actually relevant and useful for answering the question.

Question: ${input}

Retrieved Contexts:
${contextList}

Rate from 0.0 to 1.0 where:
- 0.0 = none of the contexts are relevant
- 0.5 = about half the contexts are relevant
- 1.0 = all contexts are relevant

Respond with ONLY a number between 0.0 and 1.0, nothing else.`;

  const result = await llmScore(llm, prompt, 'context_precision');
  return { ...result, name: 'context_precision' };
};

/**
 * Context Recall — does the context cover all aspects of the expected answer?
 * Uses LLM as judge. Requires expectedOutput.
 */
export const contextRecall: MetricFn = async ({ input: _input, output: _output, expectedOutput, context, llm }) => {
  if (!context || context.length === 0) {
    return { name: 'context_recall', score: 0, details: { reason: 'no context provided' } };
  }
  if (!expectedOutput) {
    return { name: 'context_recall', score: 0, details: { reason: 'no expected output provided' } };
  }

  const contextText = context.join('\n---\n');
  const prompt = `You are an evaluation judge. Given the following expected answer and retrieved context, rate how well the context covers all the information needed to produce the expected answer.

Expected Answer: ${expectedOutput}

Retrieved Context:
${contextText}

Rate from 0.0 to 1.0 where:
- 0.0 = context contains none of the required information
- 0.5 = context covers about half the required information
- 1.0 = context fully covers all information needed for the expected answer

Respond with ONLY a number between 0.0 and 1.0, nothing else.`;

  const result = await llmScore(llm, prompt, 'context_recall');
  return { ...result, name: 'context_recall' };
};

/**
 * Answer Relevance — is the generated answer semantically close to the question?
 * Uses cosine similarity via embedding (does NOT use LLM judge).
 */
export const answerRelevance: MetricFn = async ({ input, output, llm }) => {
  const [[qVec], [aVec]] = await Promise.all([
    llm.embed(input),
    llm.embed(output),
  ]);

  if (!qVec || !aVec) {
    return { name: 'answer_relevance', score: 0, details: { reason: 'embedding failed' } };
  }

  const score = Math.max(0, Math.min(1, cosineSimilarity(qVec, aVec)));
  return { name: 'answer_relevance', score };
};

/**
 * Semantic Similarity — how close is the generated answer to the expected answer?
 * Uses cosine similarity via embedding. Requires expectedOutput.
 */
export const semanticSimilarity: MetricFn = async ({ output, expectedOutput, llm }) => {
  if (!expectedOutput) {
    return { name: 'semantic_similarity', score: 0, details: { reason: 'no expected output provided' } };
  }

  const [[outVec], [expVec]] = await Promise.all([
    llm.embed(output),
    llm.embed(expectedOutput),
  ]);

  if (!outVec || !expVec) {
    return { name: 'semantic_similarity', score: 0, details: { reason: 'embedding failed' } };
  }

  const score = Math.max(0, Math.min(1, cosineSimilarity(outVec, expVec)));
  return { name: 'semantic_similarity', score };
};

/**
 * All RAGAS metrics collected.
 */
export const ragasMetrics = {
  contextPrecision,
  contextRecall,
  answerRelevance,
  semanticSimilarity,
};
