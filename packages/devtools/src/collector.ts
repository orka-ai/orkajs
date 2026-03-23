import { generateId } from '@orka-js/core';
import type {
  TraceRun,
  TraceRunType,
  TraceSession,
  TraceMetrics,
  TraceMetadata,
  TraceEvent,
  DevToolsConfig,
} from './types.js';

/**
 * TraceCollector - Collects and manages trace data for DevTools
 */
export class TraceCollector {
  private sessions: Map<string, TraceSession> = new Map();
  private activeSessionId?: string;
  private runStack: Map<string, TraceRun[]> = new Map();
  private maxTraces: number;
  private retentionMs: number;
  private listeners: Set<(event: TraceEvent) => void> = new Set();

  constructor(config: DevToolsConfig = {}) {
    this.maxTraces = config.maxTraces ?? 1000;
    this.retentionMs = config.retentionMs ?? 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Start a new trace session
   */
  startSession(name?: string): string {
    const sessionId = generateId();
    const session: TraceSession = {
      id: sessionId,
      name: name ?? `Session ${this.sessions.size + 1}`,
      startTime: Date.now(),
      runs: [],
    };

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;
    this.runStack.set(sessionId, []);

    this.emit({
      type: 'session:start',
      timestamp: Date.now(),
      sessionId,
    });

    this.cleanup();
    return sessionId;
  }

  /**
   * End the current session
   */
  endSession(sessionId?: string): void {
    const id = sessionId ?? this.activeSessionId;
    if (!id) return;

    const session = this.sessions.get(id);
    if (session) {
      session.endTime = Date.now();
      this.emit({
        type: 'session:end',
        timestamp: Date.now(),
        sessionId: id,
      });
    }

    if (this.activeSessionId === id) {
      this.activeSessionId = undefined;
    }
  }

  /**
   * Start a new trace run
   */
  startRun(
    type: TraceRunType,
    name: string,
    input?: unknown,
    metadata?: TraceMetadata
  ): string {
    const sessionId = this.activeSessionId ?? this.startSession();
    const session = this.sessions.get(sessionId)!;
    const stack = this.runStack.get(sessionId)!;

    const run: TraceRun = {
      id: generateId(),
      parentId: stack.length > 0 ? stack[stack.length - 1].id : undefined,
      type,
      name,
      startTime: Date.now(),
      status: 'running',
      input,
      metadata,
      children: [],
    };

    // Add to parent's children or session root
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(run);
    } else {
      session.runs.push(run);
    }

    stack.push(run);

    this.emit({
      type: 'run:start',
      timestamp: Date.now(),
      sessionId,
      run,
    });

    return run.id;
  }

  /**
   * End a trace run
   */
  endRun(runId: string, output?: unknown, metadata?: TraceMetadata): void {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;

    const stack = this.runStack.get(sessionId);
    if (!stack) return;

    const runIndex = stack.findIndex(r => r.id === runId);
    if (runIndex === -1) return;

    const run = stack[runIndex];
    run.endTime = Date.now();
    run.latencyMs = run.endTime - run.startTime;
    run.status = 'success';
    run.output = output;

    if (metadata) {
      run.metadata = { ...run.metadata, ...metadata };
    }

    // Pop from stack
    stack.splice(runIndex, 1);

    this.emit({
      type: 'run:end',
      timestamp: Date.now(),
      sessionId,
      run,
    });
  }

  /**
   * Mark a run as errored
   */
  errorRun(runId: string, error: Error | string): void {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;

    const stack = this.runStack.get(sessionId);
    if (!stack) return;

    const runIndex = stack.findIndex(r => r.id === runId);
    if (runIndex === -1) return;

    const run = stack[runIndex];
    run.endTime = Date.now();
    run.latencyMs = run.endTime - run.startTime;
    run.status = 'error';
    run.error = error instanceof Error ? error.message : error;

    stack.splice(runIndex, 1);

    this.emit({
      type: 'run:error',
      timestamp: Date.now(),
      sessionId,
      run,
      error: run.error,
    });
  }

  /**
   * Get all sessions
   */
  getSessions(): TraceSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get a specific session
   */
  getSession(sessionId: string): TraceSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get metrics for a session or all sessions
   */
  getMetrics(sessionId?: string): TraceMetrics {
    const sessions = sessionId
      ? [this.sessions.get(sessionId)].filter(Boolean) as TraceSession[]
      : Array.from(this.sessions.values());

    const metrics: TraceMetrics = {
      totalRuns: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      totalTokens: 0,
      totalCost: 0,
      errorRate: 0,
      runsByType: {} as Record<TraceRunType, number>,
      tokensByModel: {},
      costByModel: {},
    };

    let errorCount = 0;

    const processRun = (run: TraceRun) => {
      metrics.totalRuns++;
      metrics.totalLatencyMs += run.latencyMs ?? 0;

      if (run.status === 'error') errorCount++;

      // Count by type
      metrics.runsByType[run.type] = (metrics.runsByType[run.type] ?? 0) + 1;

      // Aggregate token/cost metrics
      if (run.metadata) {
        const { totalTokens, cost, model } = run.metadata;
        if (totalTokens) {
          metrics.totalTokens += totalTokens;
          if (model) {
            metrics.tokensByModel[model] = (metrics.tokensByModel[model] ?? 0) + totalTokens;
          }
        }
        if (cost) {
          metrics.totalCost += cost;
          if (model) {
            metrics.costByModel[model] = (metrics.costByModel[model] ?? 0) + cost;
          }
        }
      }

      // Process children
      for (const child of run.children) {
        processRun(child);
      }
    };

    for (const session of sessions) {
      for (const run of session.runs) {
        processRun(run);
      }
    }

    metrics.avgLatencyMs = metrics.totalRuns > 0
      ? metrics.totalLatencyMs / metrics.totalRuns
      : 0;
    metrics.errorRate = metrics.totalRuns > 0
      ? errorCount / metrics.totalRuns
      : 0;

    return metrics;
  }

  /**
   * Find a run by ID
   */
  findRun(runId: string, sessionId?: string): TraceRun | undefined {
    const sessions = sessionId
      ? [this.sessions.get(sessionId)].filter(Boolean) as TraceSession[]
      : Array.from(this.sessions.values());

    const findInRuns = (runs: TraceRun[]): TraceRun | undefined => {
      for (const run of runs) {
        if (run.id === runId) return run;
        const found = findInRuns(run.children);
        if (found) return found;
      }
      return undefined;
    };

    for (const session of sessions) {
      const found = findInRuns(session.runs);
      if (found) return found;
    }

    return undefined;
  }

  /**
   * Get time series data for visualization
   * Extracts latency, token, and cost data points over time
   * 
   * @param options - Filter options
   * @returns Time series data for charts
   */
  getTimeSeriesData(options?: {
    sessionId?: string;
    metric?: 'latency' | 'tokens' | 'cost' | 'all';
  }): {
    latency: Array<{ timestamp: number; value: number }>;
    tokens: Array<{ timestamp: number; value: number }>;
    cost: Array<{ timestamp: number; value: number }>;
  } {
    const sessions = options?.sessionId
      ? [this.sessions.get(options.sessionId)].filter(Boolean) as TraceSession[]
      : Array.from(this.sessions.values());

    const latencyData: Array<{ timestamp: number; value: number }> = [];
    const tokenData: Array<{ timestamp: number; value: number }> = [];
    const costData: Array<{ timestamp: number; value: number }> = [];

    const processRun = (run: TraceRun) => {
      // Extract latency data
      if (run.latencyMs !== undefined && (!options?.metric || options.metric === 'latency' || options.metric === 'all')) {
        latencyData.push({
          timestamp: run.startTime,
          value: run.latencyMs,
        });
      }

      // Extract token data
      if (run.metadata?.totalTokens && (!options?.metric || options.metric === 'tokens' || options.metric === 'all')) {
        tokenData.push({
          timestamp: run.startTime,
          value: run.metadata.totalTokens,
        });
      }

      // Extract cost data
      if (run.metadata?.cost && (!options?.metric || options.metric === 'cost' || options.metric === 'all')) {
        costData.push({
          timestamp: run.startTime,
          value: run.metadata.cost,
        });
      }

      // Process children recursively
      for (const child of run.children) {
        processRun(child);
      }
    };

    for (const session of sessions) {
      for (const run of session.runs) {
        processRun(run);
      }
    }

    return {
      latency: latencyData.sort((a, b) => a.timestamp - b.timestamp),
      tokens: tokenData.sort((a, b) => a.timestamp - b.timestamp),
      cost: costData.sort((a, b) => a.timestamp - b.timestamp),
    };
  }

  /**
   * Subscribe to trace events
   */
  subscribe(listener: (event: TraceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: TraceEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Cleanup old sessions
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.retentionMs;

    for (const [id, session] of this.sessions) {
      if (session.endTime && session.endTime < cutoff) {
        this.sessions.delete(id);
        this.runStack.delete(id);
      }
    }

    // Limit total sessions
    if (this.sessions.size > this.maxTraces) {
      const sorted = Array.from(this.sessions.entries())
        .sort((a, b) => a[1].startTime - b[1].startTime);
      
      const toDelete = sorted.slice(0, this.sessions.size - this.maxTraces);
      for (const [id] of toDelete) {
        this.sessions.delete(id);
        this.runStack.delete(id);
      }
    }
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.sessions.clear();
    this.runStack.clear();
    this.activeSessionId = undefined;
  }

  /**
   * Export traces as JSON
   */
  export(): string {
    return JSON.stringify({
      sessions: Array.from(this.sessions.values()),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Import traces from JSON
   */
  import(json: string): void {
    const data = JSON.parse(json) as { sessions: TraceSession[] };
    for (const session of data.sessions) {
      this.sessions.set(session.id, session);
    }
  }
}

// Global collector instance
let globalCollector: TraceCollector | undefined;

export function getCollector(config?: DevToolsConfig): TraceCollector {
  if (!globalCollector) {
    globalCollector = new TraceCollector(config);
  }
  return globalCollector;
}

export function resetCollector(): void {
  globalCollector = undefined;
}
