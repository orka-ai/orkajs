import type { Trace, TraceEvent, ObservabilityHook, LogLevel } from './types.js';
import { generateId } from '@orkajs/core';

export class Tracer {
  private traces: Map<string, Trace> = new Map();
  private hooks: ObservabilityHook[] = [];
  private logLevel: LogLevel;
  private maxTraces: number;
  private traceTtlMs?: number;

  constructor(options: { logLevel?: LogLevel; hooks?: ObservabilityHook[]; maxTraces?: number; traceTtlMs?: number } = {}) {
    this.logLevel = options.logLevel ?? 'info';
    this.maxTraces = options.maxTraces ?? 1000;
    this.traceTtlMs = options.traceTtlMs;
    if (options.hooks) {
      this.hooks = options.hooks;
    }
  }

  addHook(hook: ObservabilityHook): void {
    this.hooks.push(hook);
  }

  startTrace(name: string, metadata?: Record<string, unknown>): Trace {
    const trace: Trace = {
      id: generateId(),
      name,
      startTime: Date.now(),
      totalTokens: 0,
      events: [],
      metadata,
    };

    this.evictIfNeeded();
    this.traces.set(trace.id, trace);
    this.hooks.forEach(h => h.onTraceStart?.(trace));
    this.log('debug', `Trace started: ${name} [${trace.id}]`);

    return trace;
  }

  endTrace(traceId: string): Trace | undefined {
    const trace = this.traces.get(traceId);
    if (!trace) return undefined;

    trace.endTime = Date.now();
    trace.totalLatencyMs = trace.endTime - trace.startTime;
    trace.totalTokens = trace.events.reduce(
      (sum, e) => sum + (e.usage?.totalTokens ?? 0), 
      0
    );

    this.hooks.forEach(h => h.onTraceEnd?.(trace));
    this.log('info', `Trace ended: ${trace.name} [${trace.id}] - ${trace.totalLatencyMs}ms, ${trace.totalTokens} tokens`);

    return trace;
  }

  addEvent(traceId: string, event: Omit<TraceEvent, 'id' | 'traceId'>): TraceEvent {
    const trace = this.traces.get(traceId);
    const fullEvent: TraceEvent = {
      ...event,
      id: generateId(),
      traceId,
    };

    if (event.startTime && event.endTime) {
      fullEvent.latencyMs = event.endTime - event.startTime;
    }

    if (trace) {
      trace.events.push(fullEvent);
    }

    this.hooks.forEach(h => h.onEvent?.(fullEvent));
    this.log('debug', `Event: ${event.type}/${event.name} - ${fullEvent.latencyMs ?? 0}ms`);

    return fullEvent;
  }

  recordError(error: Error, context?: Record<string, unknown>): void {
    this.hooks.forEach(h => h.onError?.(error, context));
    this.log('error', `Error: ${error.message}`, context);
  }

  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  getAllTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  clearTraces(): void {
    this.traces.clear();
  }

  clearExpiredTraces(): number {
    if (!this.traceTtlMs) return 0;
    const now = Date.now();
    let cleared = 0;
    for (const [id, trace] of this.traces.entries()) {
      const traceTime = trace.endTime ?? trace.startTime;
      if (now - traceTime > this.traceTtlMs) {
        this.traces.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  private evictIfNeeded(): void {
    if (this.traceTtlMs) {
      this.clearExpiredTraces();
    }

    while (this.traces.size >= this.maxTraces) {
      const oldestKey = this.traces.keys().next().value;
      if (oldestKey) {
        this.traces.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) < levels.indexOf(this.logLevel)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[orka:${level}] ${timestamp}`;

    switch (level) {
      case 'debug':
        console.debug(prefix, message, data ?? '');
        break;
      case 'info':
        console.info(prefix, message, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, message, data ?? '');
        break;
      case 'error':
        console.error(prefix, message, data ?? '');
        break;
    }
  }
}
