import type { LLMAdapter, LLMGenerateOptions, LLMResult } from '@orka-js/core';

export interface FallbackConfig {
  adapters: LLMAdapter[];
  onFallback?: (error: Error, failedAdapter: string, nextAdapter: string) => void;
}

export class FallbackLLM implements LLMAdapter {
  readonly name = 'fallback';
  private adapters: LLMAdapter[];
  private onFallback?: FallbackConfig['onFallback'];

  constructor(config: FallbackConfig) {
    if (config.adapters.length === 0) {
      throw new Error('FallbackLLM requires at least one adapter');
    }
    this.adapters = config.adapters;
    this.onFallback = config.onFallback;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult> {
    let lastError: Error | undefined;

    for (let i = 0; i < this.adapters.length; i++) {
      try {
        const result = await this.adapters[i].generate(prompt, options);
        return {
          ...result,
          model: `${this.adapters[i].name}/${result.model}`,
        };
      } catch (error) {
        lastError = error as Error;

        if (i < this.adapters.length - 1 && this.onFallback) {
          this.onFallback(
            lastError,
            this.adapters[i].name,
            this.adapters[i + 1].name,
          );
        }
      }
    }

    throw new Error(
      `All LLM adapters failed. Last error: ${lastError?.message}. ` +
      `Tried: ${this.adapters.map(a => a.name).join(', ')}`,
    );
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    let lastError: Error | undefined;

    for (let i = 0; i < this.adapters.length; i++) {
      try {
        return await this.adapters[i].embed(texts);
      } catch (error) {
        lastError = error as Error;

        if (i < this.adapters.length - 1 && this.onFallback) {
          this.onFallback(
            lastError,
            this.adapters[i].name,
            this.adapters[i + 1].name,
          );
        }
      }
    }

    throw new Error(
      `All embedding adapters failed. Last error: ${lastError?.message}. ` +
      `Tried: ${this.adapters.map(a => a.name).join(', ')}`,
    );
  }
}
