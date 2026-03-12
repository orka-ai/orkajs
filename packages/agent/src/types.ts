import type { LLMAdapter, VectorDBAdapter } from '@orkajs/core';
import type { Knowledge } from '@orkajs/core';
import type { Memory } from '@orkajs/memory-store';

export interface Tool {
  name: string;
  description: string;
  parameters?: ToolParameter[];
  execute(input: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required?: boolean;
}

export interface ToolResult {
  output: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface AgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
}

export interface AgentPolicy {
  maxSteps?: number;
  noHallucination?: boolean;
  requireSource?: boolean;
  rules?: string[];
  allowedTools?: string[];
  blockedTools?: string[];
}

export interface AgentContext {
  goal: string;
  input: string;
  steps: AgentStepResult[];
  llm: LLMAdapter;
  vectorDB?: VectorDBAdapter;
  knowledge?: Knowledge;
  memory?: Memory;
  metadata: Record<string, unknown>;
}

export interface AgentStepResult {
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation: string;
  latencyMs: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AgentResult {
  input: string;
  output: string;
  steps: AgentStepResult[];
  totalLatencyMs: number;
  totalTokens: number;
  toolsUsed: string[];
  metadata: Record<string, unknown>;
}

export interface ReActAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
  verbose?: boolean;
}

export interface PlanStep {
  id: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
}

export interface PlanAndExecuteAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
  replanOnFailure?: boolean;
}

export interface PlanAndExecuteResult extends AgentResult {
  plan: PlanStep[];
}

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface OpenAIFunctionsAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  functions?: OpenAIFunction[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
}

export interface StructuredChatAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
  outputSchema?: Record<string, unknown>;
}

export interface AgentToolkit {
  name: string;
  description: string;
  tools: Tool[];
}

export interface SQLToolkitConfig {
  execute: (query: string) => Promise<string>;
  schema?: string;
  readOnly?: boolean;
  maxRows?: number;
}

export interface CSVToolkitConfig {
  data: string;
  separator?: string;
}
