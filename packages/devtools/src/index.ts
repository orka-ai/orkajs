import { TraceCollector, getCollector } from './collector.js';
import { DevToolsServer } from './server.js';
import { RemoteAgent } from './remote-agent.js';
import { RemoteViewer } from './remote-viewer.js';
import type { DevToolsConfig, DevToolsResult, TraceRunType, TraceMetadata } from './types.js';

export * from './types.js';
export { TraceCollector, getCollector, resetCollector } from './collector.js';
export { DevToolsServer } from './server.js';
export { RemoteAgent } from './remote-agent.js';
export { RemoteViewer } from './remote-viewer.js';
export { createDevToolsHook, createTracerWithDevTools } from './tracer-hook.js';
export { OpenTelemetryExporter, createOTLPExporter, type OpenTelemetryConfig } from './opentelemetry.js';
export { ReplayDebugger, createReplayDebugger, getReplayDebugger, type RunComparison, type TestCase } from './replay.js';

/**
 * Start the DevTools in the specified mode
 * 
 * @example Local development (default)
 * ```typescript
 * const { tracer, server, stop } = await devtools({ source: 'local', port: 3001 });
 * ```
 * 
 * @example Production agent (sends traces to remote collector)
 * ```typescript
 * const { tracer, stop } = await devtools({
 *   source: 'remote',
 *   mode: 'agent',
 *   remote: {
 *     endpoint: 'https://traces.mycompany.com',
 *     apiKey: process.env.COLLECTOR_API_KEY,
 *     projectId: 'my-ai-app',
 *     environment: 'production',
 *     sampling: 0.1
 *   }
 * });
 * ```
 * 
 * @example Remote viewer (listens to traces from remote collector)
 * ```typescript
 * const { tracer, server, stop } = await devtools({
 *   source: 'remote',
 *   mode: 'viewer',
 *   remote: {
 *     endpoint: 'https://traces.mycompany.com',
 *     apiKey: process.env.COLLECTOR_API_KEY,
 *     projectId: 'my-ai-app',
 *     filters: { environment: 'production', timeRange: 'last-1h' }
 *   },
 *   port: 3001
 * });
 * ```
 */
export async function devtools(config: DevToolsConfig = {}): Promise<DevToolsResult> {
  const source = config.source ?? 'local';
  const tracer = getCollector(config);

  // Log startup if verbose
  if (config.verbose) {
    console.log(`[DevTools] Starting in ${source} mode...`);
  }

  // === LOCAL MODE (default) ===
  if (source === 'local') {
    const server = new DevToolsServer(tracer, config);
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

    if (config.verbose) {
      console.log(`[DevTools] Dashboard running at http://${config.host ?? 'localhost'}:${config.port ?? 3001}`);
    }

    return {
      tracer,
      server,
      stop: () => server.stop(),
      config,
    };
  }

  // === REMOTE MODE ===
  if (!config.remote?.endpoint) {
    throw new Error('[DevTools] Remote mode requires remote.endpoint configuration');
  }

  const mode = config.mode ?? 'agent';

  // Remote Agent Mode: Send traces to collector
  if (mode === 'agent') {
    const agent = new RemoteAgent(tracer, config);
    await agent.start();

    if (config.verbose) {
      console.log(`[DevTools] Agent sending traces to ${config.remote.endpoint}`);
    }

    return {
      tracer,
      server: undefined,
      stop: () => agent.stop(),
      config,
    };
  }

  // Remote Viewer Mode: Listen to traces and display in local dashboard
  if (mode === 'viewer') {
    const viewer = new RemoteViewer(tracer, config);
    const server = new DevToolsServer(tracer, config);
    
    await Promise.all([viewer.start(), server.start()]);

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

    if (config.verbose) {
      console.log(`[DevTools] Viewer listening to ${config.remote.endpoint}`);
      console.log(`[DevTools] Dashboard running at http://${config.host ?? 'localhost'}:${config.port ?? 3001}`);
    }

    return {
      tracer,
      server,
      stop: async () => {
        await Promise.all([viewer.stop(), server.stop()]);
      },
      config,
    };
  }

  throw new Error(`[DevTools] Unknown mode: ${mode}`);
}

/**
 * Alias for devtools() - use this for semantic clarity when focusing on trace collection
 * @deprecated Use devtools() instead. This alias will be removed in v4.0.
 */
export const collector = devtools;

/**
 * Create a trace wrapper for any function
 */
export function withTrace<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: {
    name?: string;
    type?: TraceRunType;
    tracer?: TraceCollector;
  } = {}
): T {
  const tracer = options.tracer ?? getCollector();
  const name = options.name ?? fn.name ?? 'anonymous';
  const type = options.type ?? 'custom';

  return (async (...args: unknown[]) => {
    const runId = tracer.startRun(type, name, args);
    try {
      const result = await fn(...args);
      tracer.endRun(runId, result);
      return result;
    } catch (error) {
      tracer.errorRun(runId, error as Error);
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
      const tracer = getCollector();
      const runId = tracer.startRun(type, name, args);
      try {
        const result = await originalMethod.apply(this, args);
        tracer.endRun(runId, result);
        return result;
      } catch (error) {
        tracer.errorRun(runId, error as Error);
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
