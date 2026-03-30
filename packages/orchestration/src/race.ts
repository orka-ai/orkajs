import type { LLMAdapter, LLMGenerateOptions } from '@orka-js/core';
import { OrkaError, OrkaErrorCode, generateId } from '@orka-js/core';
import type { CallbackManager } from '@orka-js/core';
import type { RaceConfig, RaceResult } from './types.js';

export class RaceLLM implements LLMAdapter {
  readonly name = 'race';
  private adapters: LLMAdapter[];
  private timeout: number;
  private callbacks?: CallbackManager;

  constructor(config: RaceConfig) {
    if (config.adapters.length < 2) {
      throw new OrkaError(
        'RaceLLM requires at least 2 adapters',
        OrkaErrorCode.INVALID_CONFIG,
        'RaceLLM',
        undefined,
        { provided: config.adapters.length }
      );
    }
    this.adapters = config.adapters;
    this.timeout = config.timeout ?? 30000;
    this.callbacks = config.callbacks;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<RaceResult> {
    const startTime = Date.now();
    const cb = this.callbacks;
    const runId = (await cb?.emitLLMStart(prompt, 'race')) ?? generateId();

    try {
      const racePromises = this.adapters.map(async (adapter) => {
        const result = await adapter.generate(prompt, options);
        return { adapter: adapter.name, result };
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new OrkaError(
          `RaceLLM generate timed out after ${this.timeout}ms`,
          OrkaErrorCode.LLM_TIMEOUT,
          'RaceLLM',
          undefined,
          { timeout: this.timeout, adapters: this.adapters.map(a => a.name) }
        )), this.timeout);
      });

      const winner = await Promise.race([
        ...racePromises,
        timeoutPromise,
      ]) as { adapter: string; result: RaceResult };

      const raceResult: RaceResult = {
        ...winner.result,
        model: `race/${winner.adapter}/${winner.result.model}`,
        winnerAdapter: winner.adapter,
        latencyMs: Date.now() - startTime,
      };

      await cb?.emitLLMEnd(runId, raceResult.content, raceResult.model, raceResult.usage, Date.now() - startTime, { cost: raceResult.cost });
      return raceResult;
    } catch (err) {
      await cb?.emitLLMError(runId, err instanceof Error ? err : new Error(String(err)), 'race');
      throw err;
    }
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    const racePromises = this.adapters.map(adapter => adapter.embed(texts));

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new OrkaError(
        `RaceLLM embed timed out after ${this.timeout}ms`,
        OrkaErrorCode.LLM_TIMEOUT,
        'RaceLLM',
        undefined,
        { timeout: this.timeout, adapters: this.adapters.map(a => a.name) }
      )), this.timeout);
    });

    return Promise.race([...racePromises, timeoutPromise]);
  }
}
