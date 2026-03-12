import type { LLMAdapter } from '@orkajs/core';

export interface MetricResult {
  name: string;
  score: number;
  details?: Record<string, unknown>;
}

export interface EvalCase {
  input: string;
  expectedOutput?: string;
  knowledge?: string;
  context?: string[];
  metadata?: Record<string, unknown>;
}

export interface EvalResult {
  input: string;
  output: string;
  expectedOutput?: string;
  metrics: MetricResult[];
  latencyMs: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EvalSummary {
  totalCases: number;
  averageLatencyMs: number;
  totalTokens: number;
  metrics: Record<string, { average: number; min: number; max: number }>;
  results: EvalResult[];
}

export type MetricFn = (params: {
  input: string;
  output: string;
  expectedOutput?: string;
  context?: string[];
  llm: LLMAdapter;
}) => Promise<MetricResult>;

export const builtinMetrics: Record<string, MetricFn> = {
  relevance: async ({ input, output, llm }) => {
    const prompt = `You are an evaluation judge. Rate how relevant the following answer is to the question.

Question: ${input}
Answer: ${output}

Rate from 0.0 to 1.0 where:
- 0.0 = completely irrelevant
- 0.5 = partially relevant
- 1.0 = perfectly relevant

Respond with ONLY a number between 0.0 and 1.0, nothing else.`;

    const result = await llm.generate(prompt, { temperature: 0, maxTokens: 10 });
    const score = parseFloat(result.content.trim());
    
    return {
      name: 'relevance',
      score: isNaN(score) ? 0 : Math.min(1, Math.max(0, score)),
    };
  },

  faithfulness: async ({ output, context, llm }) => {
    if (!context || context.length === 0) {
      return { name: 'faithfulness', score: 1, details: { reason: 'no context provided' } };
    }

    const contextText = context.join('\n---\n');
    const prompt = `You are an evaluation judge. Rate how faithful the answer is to the provided context. A faithful answer only contains information that can be found in or inferred from the context.

Context:
${contextText}

Answer: ${output}

Rate from 0.0 to 1.0 where:
- 0.0 = completely hallucinated, no basis in context
- 0.5 = partially faithful, some claims not in context
- 1.0 = fully faithful, everything is grounded in context

Respond with ONLY a number between 0.0 and 1.0, nothing else.`;

    const result = await llm.generate(prompt, { temperature: 0, maxTokens: 10 });
    const score = parseFloat(result.content.trim());

    return {
      name: 'faithfulness',
      score: isNaN(score) ? 0 : Math.min(1, Math.max(0, score)),
    };
  },

  correctness: async ({ output, expectedOutput, llm }) => {
    if (!expectedOutput) {
      return { name: 'correctness', score: 0, details: { reason: 'no expected output provided' } };
    }

    const prompt = `You are an evaluation judge. Rate how correct the actual answer is compared to the expected answer. They don't need to be word-for-word identical, but should convey the same information.

Expected answer: ${expectedOutput}
Actual answer: ${output}

Rate from 0.0 to 1.0 where:
- 0.0 = completely wrong
- 0.5 = partially correct
- 1.0 = fully correct

Respond with ONLY a number between 0.0 and 1.0, nothing else.`;

    const result = await llm.generate(prompt, { temperature: 0, maxTokens: 10 });
    const score = parseFloat(result.content.trim());

    return {
      name: 'correctness',
      score: isNaN(score) ? 0 : Math.min(1, Math.max(0, score)),
    };
  },

  hallucination: async ({ output, context, llm }) => {
    if (!context || context.length === 0) {
      return { name: 'hallucination', score: 0, details: { reason: 'no context to check against' } };
    }

    const contextText = context.join('\n---\n');
    const prompt = `You are an evaluation judge. Rate the level of hallucination in the answer. Hallucination means the answer contains information NOT present in or inferable from the context.

Context:
${contextText}

Answer: ${output}

Rate from 0.0 to 1.0 where:
- 0.0 = no hallucination at all
- 0.5 = some hallucinated content
- 1.0 = entirely hallucinated

Respond with ONLY a number between 0.0 and 1.0, nothing else.`;

    const result = await llm.generate(prompt, { temperature: 0, maxTokens: 10 });
    const score = parseFloat(result.content.trim());

    return {
      name: 'hallucination',
      score: isNaN(score) ? 0 : Math.min(1, Math.max(0, score)),
    };
  },

  cost: async ({ output: _output, ...params }) => {
    void params;
    return {
      name: 'cost',
      score: 0,
      details: { note: 'cost is computed from usage, not LLM-judged' },
    };
  },
};
