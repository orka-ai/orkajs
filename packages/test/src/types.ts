import type { LLMStreamEvent } from '@orka-js/core';

export interface MockResponse {
  /** Match condition — string (exact/contains), RegExp, or function */
  when?: string | RegExp | ((prompt: string) => boolean);
  /** Text output to return */
  output?: string;
  /** Tool call to simulate */
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
    id?: string;
  };
  /** Error to throw */
  error?: Error;
  /** Simulate latency in ms */
  latencyMs?: number;
}

export interface MockCall {
  prompt: string;
  options?: unknown;
  timestamp: number;
  response: MockResponse | null;
}

export interface AgentTestResult {
  output: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; callId: string }>;
  steps: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  events: LLMStreamEvent[];
}

export interface AgentSnapshot {
  output: string;
  toolCalls: string[];
}
