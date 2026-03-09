import type { Tool, AgentPolicy, AgentResult } from '../types.js';

export type InterruptReason = 
  | 'tool_approval'
  | 'checkpoint'
  | 'review'
  | 'confirmation'
  | 'custom';

export type InterruptStatus = 'pending' | 'approved' | 'rejected' | 'modified' | 'timeout';

export interface InterruptRequest {
  id: string;
  agentId: string;
  reason: InterruptReason;
  message: string;
  data: InterruptData;
  createdAt: Date;
  timeoutMs?: number;
}

export interface InterruptData {
  toolName?: string;
  toolInput?: Record<string, unknown>;
  stepNumber?: number;
  thought?: string;
  context?: Record<string, unknown>;
}

export interface InterruptResponse {
  id: string;
  status: InterruptStatus;
  modifiedData?: InterruptData;
  feedback?: string;
  respondedAt: Date;
}

export interface Checkpoint {
  id: string;
  agentId: string;
  stepNumber: number;
  state: CheckpointState;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CheckpointState {
  input: string;
  steps: CheckpointStep[];
  context: Record<string, unknown>;
}

export interface CheckpointStep {
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation: string;
}

export interface HITLConfig {
  requireApprovalFor?: string[];
  autoApproveTools?: string[];
  checkpointEvery?: number;
  defaultTimeoutMs?: number;
  onInterrupt?: InterruptHandler;
  checkpointStore?: CheckpointStore;
}

export type InterruptHandler = (request: InterruptRequest) => Promise<InterruptResponse>;

export interface CheckpointStore {
  save(checkpoint: Checkpoint): Promise<void>;
  load(checkpointId: string): Promise<Checkpoint | null>;
  loadLatest(agentId: string): Promise<Checkpoint | null>;
  list(agentId: string): Promise<Checkpoint[]>;
  delete(checkpointId: string): Promise<void>;
}

export interface HITLAgentConfig {
  name?: string;
  goal: string;
  tools: Tool[];
  policy?: AgentPolicy;
  systemPrompt?: string;
  maxSteps?: number;
  temperature?: number;
  verbose?: boolean;
  hitl: HITLConfig;
}

export interface HITLAgentResult extends AgentResult {
  interrupts: InterruptResponse[];
  checkpoints: string[];
  wasInterrupted: boolean;
  resumedFromCheckpoint?: string;
}
