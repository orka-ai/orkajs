import type { LLMAdapter, LLMGenerateOptions } from '@orka-js/core';
import type { RaceConfig, RaceResult } from './types.js';

export class RaceLLM implements LLMAdapter {
  readonly name = 'race';
  private adapters: LLMAdapter[];
  private timeout: number;

  constructor(config: RaceConfig) {
    if (config.adapters.length < 2) {
      throw new Error('RaceLLM requires at least 2 adapters');
    }
    this.adapters = config.adapters;
    this.timeout = config.timeout ?? 30000;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<RaceResult> {
    const startTime = Date.now();

    const racePromises = this.adapters.map(async (adapter) => {
      const result = await adapter.generate(prompt, options);
      return { adapter: adapter.name, result };
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Race timeout after ${this.timeout}ms`)), this.timeout);
    });

    const winner = await Promise.race([
      ...racePromises,
      timeoutPromise,
    ]) as { adapter: string; result: RaceResult };

    return {
      ...winner.result,
      model: `race/${winner.adapter}/${winner.result.model}`,
      winnerAdapter: winner.adapter,
      latencyMs: Date.now() - startTime,
    };
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    const racePromises = this.adapters.map(async (adapter) => {
      return adapter.embed(texts);
    });

    return Promise.race(racePromises);
  }
}
