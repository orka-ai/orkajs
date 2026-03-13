import { getCollector } from './collector.js';
import type { TraceRunType, TraceMetadata } from './types.js';

/**
 * Hook interface matching @orka-js/observability
 */
interface ObservabilityHook {
  onTraceStart?: (trace: TracerTrace) => void;
  onTraceEnd?: (trace: TracerTrace) => void;
  onEvent?: (event: TracerEvent) => void;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

interface TracerTrace {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  totalLatencyMs?: number;
  totalTokens?: number;
  events: TracerEvent[];
  metadata?: Record<string, unknown>;
}

interface TracerEvent {
  id: string;
  traceId: string;
  type: string;
  name: string;
  startTime?: number;
  endTime?: number;
  latencyMs?: number;
  input?: unknown;
  output?: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Map Tracer event types to DevTools run types
 */
function mapEventType(type: string): TraceRunType {
  const typeMap: Record<string, TraceRunType> = {
    'llm': 'llm',
    'llm_call': 'llm',
    'embedding': 'embedding',
    'retrieval': 'retrieval',
    'tool': 'tool',
    'tool_call': 'tool',
    'agent': 'agent',
    'agent_step': 'agent',
    'chain': 'chain',
    'workflow': 'workflow',
    'graph': 'graph',
    'node': 'node',
  };
  return typeMap[type.toLowerCase()] ?? 'custom';
}

/**
 * Create a DevTools hook for the Tracer
 * 
 * Usage:
 * ```ts
 * import { Tracer } from '@orka-js/observability';
 * import { createDevToolsHook, devtools } from '@orka-js/devtools';
 * 
 * await devtools();
 * 
 * const tracer = new Tracer({
 *   hooks: [createDevToolsHook()]
 * });
 * ```
 */
export function createDevToolsHook(): ObservabilityHook {
  const collector = getCollector();
  const traceToSession = new Map<string, string>();
  const eventToRun = new Map<string, string>();

  return {
    onTraceStart(trace: TracerTrace) {
      // Start a new session for each trace
      const sessionId = collector.startSession(trace.name);
      traceToSession.set(trace.id, sessionId);
    },

    onTraceEnd(trace: TracerTrace) {
      const sessionId = traceToSession.get(trace.id);
      if (sessionId) {
        collector.endSession(sessionId);
        traceToSession.delete(trace.id);
      }
    },

    onEvent(event: TracerEvent) {
      const runType = mapEventType(event.type);
      
      // Build metadata
      const metadata: TraceMetadata = {
        ...event.metadata,
      };

      if (event.usage) {
        metadata.promptTokens = event.usage.promptTokens;
        metadata.completionTokens = event.usage.completionTokens;
        metadata.totalTokens = event.usage.totalTokens;
      }

      // If event has both start and end time, create a completed run
      if (event.startTime && event.endTime) {
        const runId = collector.startRun(runType, event.name, event.input, metadata);
        collector.endRun(runId, event.output, {
          ...metadata,
          // Override latency calculation since we have actual times
        });
        eventToRun.set(event.id, runId);
      } else if (event.startTime && !event.endTime) {
        // Event is starting
        const runId = collector.startRun(runType, event.name, event.input, metadata);
        eventToRun.set(event.id, runId);
      } else {
        // Event is ending (find matching start)
        const runId = eventToRun.get(event.id);
        if (runId) {
          collector.endRun(runId, event.output, metadata);
          eventToRun.delete(event.id);
        }
      }
    },

    onError(error: Error, context?: Record<string, unknown>) {
      // Find the most recent run and mark it as errored
      const sessions = collector.getSessions();
      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        if (lastSession.runs.length > 0) {
          const findRunningRun = (runs: Array<{ id: string; status: string; children: unknown[] }>): string | undefined => {
            for (const run of runs) {
              if (run.status === 'running') return run.id;
              const childRun = findRunningRun(run.children as Array<{ id: string; status: string; children: unknown[] }>);
              if (childRun) return childRun;
            }
            return undefined;
          };

          const runningRunId = findRunningRun(lastSession.runs as Array<{ id: string; status: string; children: unknown[] }>);
          if (runningRunId) {
            collector.errorRun(runningRunId, error);
          }
        }
      }

      // Log context if provided
      if (context) {
        console.error('[DevTools] Error context:', context);
      }
    },
  };
}

/**
 * Convenience function to create a Tracer with DevTools integration
 */
export function createTracerWithDevTools(options: {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  maxTraces?: number;
  traceTtlMs?: number;
} = {}): {
  hook: ObservabilityHook;
  config: typeof options & { hooks: ObservabilityHook[] };
} {
  const hook = createDevToolsHook();
  return {
    hook,
    config: {
      ...options,
      hooks: [hook],
    },
  };
}
