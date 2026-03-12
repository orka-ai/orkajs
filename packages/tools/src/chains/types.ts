import type { LLMAdapter, VectorSearchResult } from '@orka-js/core';
import type { Retriever } from '../retrievers/types.js';

export interface ChainResult {
  answer: string;
  sources?: VectorSearchResult[];
  intermediateSteps?: IntermediateStep[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface IntermediateStep {
  name: string;
  input: string;
  output: string;
  latencyMs?: number;
}

export interface RetrievalQAChainOptions {
  llm: LLMAdapter;
  retriever: Retriever;
  collection: string;
  systemPrompt?: string;
  returnSources?: boolean;
  maxSourceTokens?: number;
  topK?: number;
}

export interface ConversationalRetrievalChainOptions {
  llm: LLMAdapter;
  retriever: Retriever;
  collection: string;
  systemPrompt?: string;
  returnSources?: boolean;
  maxHistoryLength?: number;
  condenseQuestionPrompt?: string;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface SummarizationChainOptions {
  llm: LLMAdapter;
  strategy: 'stuff' | 'map-reduce' | 'refine';
  systemPrompt?: string;
  maxChunkSize?: number;
  combinePrompt?: string;
  refinePrompt?: string;
}

export interface QAChainOptions {
  llm: LLMAdapter;
  retriever: Retriever;
  collection: string;
  systemPrompt?: string;
  returnSources?: boolean;
  strategy?: 'stuff' | 'map-reduce' | 'refine';
  maxSourceTokens?: number;
}
