/**
 * DevTools Types
 */

export interface DevToolsConfig {
  port?: number;
  host?: string;
  open?: boolean;
  cors?: boolean;
  maxTraces?: number;
  retentionMs?: number;
}

export interface TraceRun {
  id: string;
  parentId?: string;
  type: TraceRunType;
  name: string;
  startTime: number;
  endTime?: number;
  latencyMs?: number;
  status: 'running' | 'success' | 'error';
  input?: unknown;
  output?: unknown;
  error?: string;
  metadata?: TraceMetadata;
  children: TraceRun[];
}

export type TraceRunType = 
  | 'agent'
  | 'llm'
  | 'tool'
  | 'retrieval'
  | 'chain'
  | 'workflow'
  | 'graph'
  | 'node'
  | 'embedding'
  | 'custom';

export interface TraceMetadata {
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
  temperature?: number;
  maxTokens?: number;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  nodeId?: string;
  threadId?: string;
  [key: string]: unknown;
}

export interface TraceSession {
  id: string;
  name?: string;
  startTime: number;
  endTime?: number;
  runs: TraceRun[];
  metadata?: Record<string, unknown>;
}

export interface TraceMetrics {
  totalRuns: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  errorRate: number;
  runsByType: Record<TraceRunType, number>;
  tokensByModel: Record<string, number>;
  costByModel: Record<string, number>;
}

export interface DevToolsState {
  sessions: TraceSession[];
  activeSessionId?: string;
  metrics: TraceMetrics;
  isRecording: boolean;
}

export interface TraceEvent {
  type: 'run:start' | 'run:end' | 'run:error' | 'session:start' | 'session:end';
  timestamp: number;
  sessionId: string;
  run?: TraceRun;
  error?: string;
}

export interface ReplayOptions {
  runId: string;
  sessionId: string;
  modifyInput?: (input: unknown) => unknown;
}

export interface ReplayResult {
  originalRun: TraceRun;
  replayedRun: TraceRun;
  diff: {
    inputChanged: boolean;
    outputChanged: boolean;
    latencyDiff: number;
  };
}
