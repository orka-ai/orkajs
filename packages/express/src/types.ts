import type { Request } from 'express';
import type { BaseAgent } from '@orka-js/agent';

export interface OrkaExpressConfig {
  /** Map of agent name → agent instance */
  agents: Record<string, BaseAgent>;
  /** Optional auth function — return false to reject with 401 */
  auth?: (req: Request) => boolean | Promise<boolean>;
  /** CORS origin header value — default '*', set false to disable */
  cors?: string | false;
}

export interface AgentRunRequest {
  input: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRunResponse {
  output: string;
  toolsUsed: string[];
  totalLatencyMs: number;
  totalTokens: number;
  metadata: Record<string, unknown>;
}
