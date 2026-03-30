import type { LLMAdapter, LLMGenerateOptions, LLMResult, CallbackManager } from '@orka-js/core';

export interface RouterConfig {
  routes: Route[];
  defaultAdapter: LLMAdapter;
  /** CallbackManager for centralized observability */
  callbacks?: CallbackManager;
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
  /** CallbackManager for centralized observability */
  callbacks?: CallbackManager;
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
  /** CallbackManager for centralized observability */
  callbacks?: CallbackManager;
}

export interface RaceResult extends LLMResult {
  winnerAdapter: string;
  latencyMs: number;
}

export interface LoadBalancerConfig {
  adapters: LLMAdapter[];
  strategy: 'round_robin' | 'random' | 'least_tokens';
  /** CallbackManager for centralized observability */
  callbacks?: CallbackManager;
}
