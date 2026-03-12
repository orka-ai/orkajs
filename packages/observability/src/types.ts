export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface TraceEvent {
  id: string;
  traceId: string;
  type: 'llm' | 'retrieval' | 'workflow' | 'agent' | 'tool' | 'custom';
  name: string;
  startTime: number;
  endTime?: number;
  latencyMs?: number;
  input?: string;
  output?: string;
  metadata?: Record<string, unknown>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
  parentId?: string;
}

export interface Trace {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  totalLatencyMs?: number;
  totalTokens: number;
  events: TraceEvent[];
  metadata?: Record<string, unknown>;
}

export interface ObservabilityHook {
  onTraceStart?(trace: Trace): void;
  onTraceEnd?(trace: Trace): void;
  onEvent?(event: TraceEvent): void;
  onError?(error: Error, context?: Record<string, unknown>): void;
}
