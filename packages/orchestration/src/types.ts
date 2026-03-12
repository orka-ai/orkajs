import type { LLMAdapter, LLMGenerateOptions, LLMResult } from '@orkajs/core';

export interface RouterConfig {
  routes: Route[];
  defaultAdapter: LLMAdapter;
}

export interface Route {
  condition: (prompt: string, options?: LLMGenerateOptions) => boolean;
  adapter: LLMAdapter;
  name?: string;
}

export interface ConsensusConfig {
  adapters: LLMAdapter[];
  strategy: 'majority' | 'best_score' | 'merge';
  judge?: LLMAdapter;
  temperature?: number;
}

export interface ConsensusResult extends LLMResult {
  responses: Array<{
    adapter: string;
    content: string;
    score?: number;
  }>;
  selectedAdapter: string;
}

export interface RaceConfig {
  adapters: LLMAdapter[];
  timeout?: number;
}

export interface RaceResult extends LLMResult {
  winnerAdapter: string;
  latencyMs: number;
}

export interface LoadBalancerConfig {
  adapters: LLMAdapter[];
  strategy: 'round_robin' | 'random' | 'least_tokens';
}
