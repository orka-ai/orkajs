import type { LLMAdapter, LLMGenerateOptions, LLMResult } from '../types/index.js';
import type { LoadBalancerConfig } from './types.js';

export class LoadBalancerLLM implements LLMAdapter {
  readonly name = 'load-balancer';
  private adapters: LLMAdapter[];
  private strategy: LoadBalancerConfig['strategy'];
  private currentIndex = 0;
  private tokenCounts: Map<string, number> = new Map();

  constructor(config: LoadBalancerConfig) {
    if (config.adapters.length === 0) {
      throw new Error('LoadBalancerLLM requires at least 1 adapter');
    }
    this.adapters = config.adapters;
    this.strategy = config.strategy;
    for (const adapter of this.adapters) {
      this.tokenCounts.set(adapter.name, 0);
    }
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult> {
    const adapter = this.selectAdapter();
    const result = await adapter.generate(prompt, options);

    this.tokenCounts.set(
      adapter.name,
      (this.tokenCounts.get(adapter.name) ?? 0) + result.usage.totalTokens,
    );

    return {
      ...result,
      model: `lb/${adapter.name}/${result.model}`,
    };
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    const adapter = this.selectAdapter();
    return adapter.embed(texts);
  }

  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [name, tokens] of this.tokenCounts.entries()) {
      stats[name] = tokens;
    }
    return stats;
  }

  resetStats(): void {
    for (const adapter of this.adapters) {
      this.tokenCounts.set(adapter.name, 0);
    }
  }

  private selectAdapter(): LLMAdapter {
    switch (this.strategy) {
      case 'round_robin':
        return this.roundRobin();
      case 'random':
        return this.random();
      case 'least_tokens':
        return this.leastTokens();
      default:
        return this.roundRobin();
    }
  }

  private roundRobin(): LLMAdapter {
    const adapter = this.adapters[this.currentIndex % this.adapters.length];
    this.currentIndex++;
    return adapter;
  }

  private random(): LLMAdapter {
    const idx = Math.floor(Math.random() * this.adapters.length);
    return this.adapters[idx];
  }

  private leastTokens(): LLMAdapter {
    let minTokens = Infinity;
    let selected = this.adapters[0];

    for (const adapter of this.adapters) {
      const tokens = this.tokenCounts.get(adapter.name) ?? 0;
      if (tokens < minTokens) {
        minTokens = tokens;
        selected = adapter;
      }
    }

    return selected;
  }
}
