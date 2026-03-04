import type { LLMAdapter, VectorDBAdapter, RetrievedContext } from '../types/index.js';
import type { Knowledge } from '../core/knowledge.js';

export interface WorkflowContext {
  input: string;
  output: string;
  history: WorkflowStepResult[];
  context: RetrievedContext[];
  metadata: Record<string, unknown>;
  llm: LLMAdapter;
  vectorDB?: VectorDBAdapter;
  knowledge?: Knowledge;
}

export interface WorkflowStepResult {
  stepName: string;
  output: string;
  latencyMs: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

export interface WorkflowStep {
  name: string;
  execute(ctx: WorkflowContext): Promise<WorkflowContext>;
}

export interface WorkflowConfig {
  name: string;
  steps: WorkflowStep[];
  onStepComplete?: (result: WorkflowStepResult, ctx: WorkflowContext) => void;
  onError?: (error: Error, stepName: string, ctx: WorkflowContext) => void;
  maxRetries?: number;
}

export interface WorkflowResult {
  name: string;
  input: string;
  output: string;
  steps: WorkflowStepResult[];
  totalLatencyMs: number;
  totalTokens: number;
  metadata: Record<string, unknown>;
}
