import type { LLMAdapter, LLMGenerateOptions, LLMResult, CallbackManager } from '@orka-js/core';
import { OrkaError, OrkaErrorCode, generateId } from '@orka-js/core';
import type { ConsensusConfig, ConsensusResult } from './types.js';

export class ConsensusLLM implements LLMAdapter {
  readonly name = 'consensus';
  private adapters: LLMAdapter[];
  private strategy: ConsensusConfig['strategy'];
  private judge?: LLMAdapter;
  private temperature: number;
  private callbacks?: CallbackManager;

  constructor(config: ConsensusConfig) {
    if (config.adapters.length < 2) {
      throw new OrkaError(
        'ConsensusLLM requires at least 2 adapters',
        OrkaErrorCode.INVALID_CONFIG,
        'ConsensusLLM',
        undefined,
        { provided: config.adapters.length }
      );
    }
    this.adapters = config.adapters;
    this.strategy = config.strategy;
    this.judge = config.judge ?? config.adapters[0];
    this.temperature = config.temperature ?? 0;
    this.callbacks = config.callbacks;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<ConsensusResult> {
    const cb = this.callbacks;
    const runId = (await cb?.emitLLMStart(prompt, 'consensus')) ?? generateId();
    const responses = await Promise.all(
      this.adapters.map(async (adapter) => {
        try {
          const result = await adapter.generate(prompt, options);
          return { adapter: adapter.name, content: result.content, result };
        } catch (error) {
          return { adapter: adapter.name, content: '', result: null, error: (error as Error).message };
        }
      })
    );

    const validResponses = responses.filter(r => r.result !== null);
    if (validResponses.length === 0) {
      const failures = responses.map(r => ({ adapter: r.adapter, error: r.error }));
      const err = new OrkaError(
        'All adapters failed in ConsensusLLM',
        OrkaErrorCode.LLM_API_ERROR,
        'ConsensusLLM',
        undefined,
        { failures }
      );
      await cb?.emitLLMError(runId, err, 'consensus');
      throw err;
    }

    let selectedContent: string;
    let selectedAdapter: string;
    const scoredResponses: Array<{ adapter: string; content: string; score?: number }> = [];

    switch (this.strategy) {
      case 'best_score': {
        const scored = await this.scoreResponses(prompt, validResponses);
        scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        selectedContent = scored[0].content;
        selectedAdapter = scored[0].adapter;
        scoredResponses.push(...scored);
        break;
      }
      case 'merge': {
        const merged = await this.mergeResponses(prompt, validResponses);
        selectedContent = merged;
        selectedAdapter = 'merged';
        scoredResponses.push(...validResponses.map(r => ({ adapter: r.adapter, content: r.content })));
        break;
      }
      case 'majority':
      default: {
        const best = await this.selectMajority(prompt, validResponses);
        selectedContent = best.content;
        selectedAdapter = best.adapter;
        scoredResponses.push(...validResponses.map(r => ({ adapter: r.adapter, content: r.content })));
        break;
      }
    }

    const totalUsage = validResponses.reduce(
      (acc, r) => ({
        promptTokens: acc.promptTokens + (r.result?.usage.promptTokens ?? 0),
        completionTokens: acc.completionTokens + (r.result?.usage.completionTokens ?? 0),
        totalTokens: acc.totalTokens + (r.result?.usage.totalTokens ?? 0),
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );

    const result: ConsensusResult = {
      content: selectedContent,
      usage: totalUsage,
      model: `consensus/${selectedAdapter}`,
      finishReason: 'stop',
      responses: scoredResponses,
      selectedAdapter,
    };

    await cb?.emitLLMEnd(runId, result.content, result.model, result.usage, 0);
    return result;
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    return this.adapters[0].embed(texts);
  }

  private async scoreResponses(
    prompt: string,
    responses: Array<{ adapter: string; content: string; result: LLMResult | null }>
  ): Promise<Array<{ adapter: string; content: string; score: number }>> {
    if (!this.judge) return responses.map(r => ({ ...r, score: 0 }));

    const judgePrompt = `You are a judge. Rate each response to the following prompt on a scale of 0.0 to 1.0.

Prompt: ${prompt}

${responses.map((r, i) => `Response ${i + 1} (${r.adapter}):\n${r.content}`).join('\n\n')}

Rate each response. Respond with ONLY a JSON array of numbers, e.g. [0.8, 0.6, 0.9]`;

    const judgeResult = await this.judge.generate(judgePrompt, { temperature: this.temperature, maxTokens: 100 });

    let scores: number[];
    try {
      const match = judgeResult.content.match(/\[[\d.,\s]+\]/);
      scores = JSON.parse(match?.[0] ?? '[]');
    } catch {
      scores = responses.map(() => 0.5);
    }

    return responses.map((r, i) => ({
      adapter: r.adapter,
      content: r.content,
      score: scores[i] ?? 0.5,
    }));
  }

  private async mergeResponses(
    prompt: string,
    responses: Array<{ adapter: string; content: string }>
  ): Promise<string> {
    if (!this.judge) return responses[0].content;

    const mergePrompt = `You are given multiple AI responses to the same prompt. Synthesize them into a single, best response that combines the strengths of each.

Original prompt: ${prompt}

${responses.map((r, i) => `Response ${i + 1} (${r.adapter}):\n${r.content}`).join('\n\n')}

Provide the synthesized response:`;

    const result = await this.judge.generate(mergePrompt, { temperature: this.temperature, maxTokens: 2048 });
    return result.content;
  }

  private async selectMajority(
    prompt: string,
    responses: Array<{ adapter: string; content: string }>
  ): Promise<{ adapter: string; content: string }> {
    if (responses.length === 1) return responses[0];
    if (!this.judge) return responses[0];

    const judgePrompt = `You are a judge. Given multiple responses to a prompt, select the best one.

Prompt: ${prompt}

${responses.map((r, i) => `Response ${i + 1} (${r.adapter}):\n${r.content}`).join('\n\n')}

Which response number is best? Respond with ONLY the number (e.g., "1" or "2").`;

    const result = await this.judge.generate(judgePrompt, { temperature: this.temperature, maxTokens: 10 });
    const idx = parseInt(result.content.trim()) - 1;

    if (idx >= 0 && idx < responses.length) {
      return responses[idx];
    }
    return responses[0];
  }
}
