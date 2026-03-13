import { TraceCollector, getCollector } from './collector.js';
import { DevToolsServer } from './server.js';
import type { DevToolsConfig, TraceRunType, TraceMetadata } from './types.js';

export * from './types.js';
export { TraceCollector, getCollector, resetCollector } from './collector.js';
export { DevToolsServer } from './server.js';
export { createDevToolsHook, createTracerWithDevTools } from './tracer-hook.js';
export { OpenTelemetryExporter, createOTLPExporter, type OpenTelemetryConfig } from './opentelemetry.js';
export { ReplayDebugger, createReplayDebugger, getReplayDebugger, type RunComparison, type TestCase } from './replay.js';

/**
 * Start the DevTools dashboard
 */
export async function devtools(config: DevToolsConfig = {}): Promise<{
  collector: TraceCollector;
  server: DevToolsServer;
  stop: () => Promise<void>;
}> {
  const collector = getCollector(config);
  const server = new DevToolsServer(collector, config);
  
  await server.start();

  // Open browser if requested
  if (config.open !== false) {
    const url = `http://${config.host ?? 'localhost'}:${config.port ?? 3001}`;
    try {
      const { exec } = await import('child_process');
      const command = process.platform === 'darwin' ? 'open' :
                      process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${command} ${url}`);
    } catch {
      // Ignore if can't open browser
    }
  }

  return {
    collector,
    server,
    stop: () => server.stop(),
  };
}

/**
 * Create a trace wrapper for any function
 */
export function withTrace<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: {
    name?: string;
    type?: TraceRunType;
    collector?: TraceCollector;
  } = {}
): T {
  const collector = options.collector ?? getCollector();
  const name = options.name ?? fn.name ?? 'anonymous';
  const type = options.type ?? 'custom';

  return (async (...args: unknown[]) => {
    const runId = collector.startRun(type, name, args);
    try {
      const result = await fn(...args);
      collector.endRun(runId, result);
      return result;
    } catch (error) {
      collector.errorRun(runId, error as Error);
      throw error;
    }
  }) as T;
}

/**
 * Decorator for tracing class methods
 */
export function Trace(options: {
  name?: string;
  type?: TraceRunType;
} = {}) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = options.name ?? propertyKey;
    const type = options.type ?? 'custom';

    descriptor.value = async function (...args: unknown[]) {
      const collector = getCollector();
      const runId = collector.startRun(type, name, args);
      try {
        const result = await originalMethod.apply(this, args);
        collector.endRun(runId, result);
        return result;
      } catch (error) {
        collector.errorRun(runId, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Manual tracing helpers
 */
export const trace = {
  start(type: TraceRunType, name: string, input?: unknown, metadata?: TraceMetadata): string {
    return getCollector().startRun(type, name, input, metadata);
  },
  
  end(runId: string, output?: unknown, metadata?: TraceMetadata): void {
    getCollector().endRun(runId, output, metadata);
  },
  
  error(runId: string, error: Error | string): void {
    getCollector().errorRun(runId, error);
  },
  
  session(name?: string): string {
    return getCollector().startSession(name);
  },
  
  endSession(sessionId?: string): void {
    getCollector().endSession(sessionId);
  },

  /**
   * Wrap an async function with tracing
   */
  async wrap<T>(
    type: TraceRunType,
    name: string,
    fn: () => Promise<T>,
    metadata?: TraceMetadata
  ): Promise<T> {
    const runId = getCollector().startRun(type, name, undefined, metadata);
    try {
      const result = await fn();
      getCollector().endRun(runId, result);
      return result;
    } catch (error) {
      getCollector().errorRun(runId, error as Error);
      throw error;
    }
  },
};
