/**
 * DevTools Types
 */

/**
 * Source mode for trace collection
 * - 'local': Run dashboard locally (development)
 * - 'remote': Send traces to a remote collector (production)
 */
export type CollectorSource = 'local' | 'remote';

/**
 * Operation mode for remote source
 * - 'agent': Send traces to the collector
 * - 'viewer': Listen to traces from the collector
 */
export type CollectorMode = 'agent' | 'viewer';

/**
 * Remote collector configuration
 */
export interface RemoteCollectorConfig {
  /** Remote collector endpoint URL */
  endpoint: string;
  /** API key for authentication */
  apiKey?: string;
  /** Project identifier */
  projectId?: string;
  /** Environment tag */
  environment?: 'development' | 'staging' | 'production';
  /** Sampling rate (0-1) for production tracing */
  sampling?: number;
  /** Filters for viewer mode */
  filters?: {
    userId?: string;
    traceId?: string;
    sessionId?: string;
    timeRange?: string;
    environment?: string;
    tags?: Record<string, string>;
  };
}

/**
 * DevTools configuration
 */
export interface DevToolsConfig {
  /** Source mode: 'local' (default) or 'remote' */
  source?: CollectorSource;
  /** Operation mode for remote: 'agent' or 'viewer' */
  mode?: CollectorMode;
  /** Remote collector configuration */
  remote?: RemoteCollectorConfig;
  /** Local server port (default: 3001) */
  port?: number;
  /** Local server host (default: 'localhost') */
  host?: string;
  /** Open browser on start (default: true for local) */
  open?: boolean;
  /** Enable CORS (default: true) */
  cors?: boolean;
  /** Maximum traces to keep in memory */
  maxTraces?: number;
  /** Trace retention time in ms (default: 24h) */
  retentionMs?: number;
  /** Verbose logging */
  verbose?: boolean;
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

/**
 * Result returned by devtools() function
 */
export interface DevToolsResult {
  /** Trace collector instance (renamed from 'collector' for clarity) */
  tracer: import('./collector.js').TraceCollector;
  /** DevTools server instance (only for local mode) */
  server?: import('./server.js').DevToolsServer;
  /** Stop the devtools server/agent */
  stop: () => Promise<void>;
  /** Current configuration */
  config: DevToolsConfig;
}
