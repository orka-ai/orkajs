import type { LLMAdapter, LLMGenerateOptions, LLMResult, OrkaSchema } from '@orka-js/core';
import type { RouterConfig } from './types.js';

export class RouterLLM implements LLMAdapter {
  readonly name = 'router';
  private routes: RouterConfig['routes'];
  private defaultAdapter: LLMAdapter;

  constructor(config: RouterConfig) {
    this.routes = config.routes;
    this.defaultAdapter = config.defaultAdapter;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult> {
    const adapter = this.resolve(prompt, options);
    const result = await adapter.generate(prompt, options);
    return {
      ...result,
      model: `${adapter.name}/${result.model}`,
    };
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    return this.defaultAdapter.embed(texts);
  }

  async generateObject<T>(schema: OrkaSchema<T>, prompt: string, options?: LLMGenerateOptions): Promise<T> {
    const adapter = this.resolve(prompt, options);
    return adapter.generateObject(schema, prompt, options);
  }

  private resolve(prompt: string, options?: LLMGenerateOptions): LLMAdapter {
    for (const route of this.routes) {
      if (route.condition(prompt, options)) {
        return route.adapter;
      }
    }
    return this.defaultAdapter;
  }
}
