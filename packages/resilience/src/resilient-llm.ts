import type { LLMAdapter, LLMGenerateOptions, LLMResult } from '@orka-js/core';
import { withRetry, type RetryOptions } from './retry.js';

export interface ResilientLLMConfig {
  llm: LLMAdapter;
  retry?: RetryOptions;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_RETRYABLE_PATTERNS = [
  'rate limit',
  'Rate limit',
  '429',
  '500',
  '502',
  '503',
  'timeout',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'AbortError',
  'timed out',
];

export class ResilientLLM implements LLMAdapter {
  readonly name: string;
  private llm: LLMAdapter;
  private retryOptions: RetryOptions;

  constructor(config: ResilientLLMConfig) {
    this.llm = config.llm;
    this.name = `resilient-${config.llm.name}`;
    this.retryOptions = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: DEFAULT_RETRYABLE_PATTERNS,
      onRetry: config.onRetry,
      ...config.retry,
    };
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult> {
    return withRetry(
      () => this.llm.generate(prompt, options),
      this.retryOptions,
    );
  }

  async embed(texts: string | string[]): Promise<number[][]> {
    return withRetry(
      () => this.llm.embed(texts),
      this.retryOptions,
    );
  }

  getInnerLLM(): LLMAdapter {
    return this.llm;
  }
}
