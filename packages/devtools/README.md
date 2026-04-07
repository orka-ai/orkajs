# @orka-js/devtools

Developer tools for tracing, debugging, and monitoring OrkaJS agents — local dashboard and remote viewer.

## Installation

```bash
npm install @orka-js/devtools
```

## Quick Start

```typescript
import { devtools, trace } from '@orka-js/devtools';

// Start the local dashboard (opens http://localhost:3001 in your browser)
const { tracer, stop } = await devtools({ source: 'local', port: 3001 });

// Wrap any async function with automatic tracing
const runId = trace.start('agent', 'my-agent', { query: 'Hello' });
try {
  const result = await myAgent.run('Hello');
  trace.end(runId, result);
} catch (err) {
  trace.error(runId, err as Error);
  throw err;
}

// Or use the withTrace helper
import { withTrace } from '@orka-js/devtools';

const tracedFn = withTrace(myExpensiveFunction, { name: 'my-fn', type: 'custom' });
await tracedFn(args); // automatically traced

// Or the @Trace() decorator on class methods
import { Trace } from '@orka-js/devtools';

class MyService {
  @Trace({ name: 'fetch-data', type: 'tool' })
  async fetchData(query: string) {
    // ...
  }
}

await stop();
```

### Integration with `@orka-js/observability`

```typescript
import { Tracer } from '@orka-js/observability';
import { devtools, createDevToolsHook } from '@orka-js/devtools';

await devtools();

const tracer = new Tracer({
  hooks: [createDevToolsHook()],
});
```

### Remote mode — production tracing

```typescript
// In your production agent process:
const { stop } = await devtools({
  source: 'remote',
  mode: 'agent',
  remote: {
    endpoint: 'https://traces.mycompany.com',
    apiKey: process.env.COLLECTOR_API_KEY,
    projectId: 'my-ai-app',
    environment: 'production',
    sampling: 0.1,   // trace 10% of requests
  },
});

// On your developer machine, view production traces live:
await devtools({
  source: 'remote',
  mode: 'viewer',
  remote: {
    endpoint: 'https://traces.mycompany.com',
    apiKey: process.env.COLLECTOR_API_KEY,
    projectId: 'my-ai-app',
    filters: { environment: 'production', timeRange: 'last-1h' },
  },
  port: 3001,
});
```

## API

### `devtools(config?)`

Starts DevTools in the specified mode and returns a `DevToolsResult`.

```typescript
await devtools(config?: DevToolsConfig): Promise<DevToolsResult>
```

**`DevToolsConfig`**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `source` | `'local' \| 'remote'` | `'local'` | Local dashboard or remote collector |
| `mode` | `'agent' \| 'viewer'` | `'agent'` | Remote mode: send or receive traces |
| `remote` | `RemoteCollectorConfig` | — | Required when `source: 'remote'` |
| `port` | `number` | `3001` | Local server port |
| `host` | `string` | `'localhost'` | Local server host |
| `open` | `boolean` | `true` | Open browser automatically (local mode) |
| `maxTraces` | `number` | `1000` | Maximum traces kept in memory |
| `retentionMs` | `number` | `86400000` | Trace retention time (24 h) |
| `verbose` | `boolean` | `false` | Enable startup and error logging |

**`DevToolsResult`**

```typescript
interface DevToolsResult {
  tracer: TraceCollector;         // the trace collector instance
  server?: DevToolsServer;        // local dashboard server (local mode only)
  stop: () => Promise<void>;      // shut down cleanly
  config: DevToolsConfig;
}
```

---

### Manual tracing — `trace` helpers

The `trace` object provides low-level, imperative tracing.

```typescript
import { trace } from '@orka-js/devtools';

// Sessions group related runs
const sessionId = trace.session('user-request-42');

const runId = trace.start('agent', 'my-agent', inputPayload, { model: 'gpt-4o' });
try {
  const output = await doWork();
  trace.end(runId, output);
} catch (err) {
  trace.error(runId, err as Error);
}

trace.endSession(sessionId);

// Convenience wrapper
const result = await trace.wrap('llm', 'summarize', async () => {
  return await llm.generate(prompt);
}, { model: 'gpt-4o-mini' });
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `trace.start` | `(type, name, input?, metadata?) → runId` | Begin a traced run |
| `trace.end` | `(runId, output?, metadata?)` | Complete a run successfully |
| `trace.error` | `(runId, error)` | Mark a run as failed |
| `trace.session` | `(name?) → sessionId` | Start a new session |
| `trace.endSession` | `(sessionId?)` | End the current or specified session |
| `trace.wrap` | `(type, name, fn, metadata?) → Promise<T>` | Wrap an async function with tracing |

**`TraceRunType`** values: `'agent'` | `'llm'` | `'tool'` | `'retrieval'` | `'chain'` | `'workflow'` | `'graph'` | `'node'` | `'embedding'` | `'custom'`

---

### `withTrace(fn, options?)`

Wraps any function to trace it automatically on every call.

```typescript
const tracedFetch = withTrace(fetchData, {
  name: 'fetch-data',
  type: 'tool',
});
```

---

### `@Trace(options?)` decorator

Decorates a class method to trace it without any call-site changes.

```typescript
class MyAgent {
  @Trace({ type: 'agent' })
  async run(input: string) { /* ... */ }
}
```

---

### `TraceCollector`

Low-level class that stores and manages trace data. Access the global instance with `getCollector()`.

```typescript
import { TraceCollector, getCollector, resetCollector } from '@orka-js/devtools';

const collector = getCollector();

collector.startSession(name?)          // → sessionId
collector.endSession(sessionId?)
collector.startRun(type, name, input?, metadata?)  // → runId
collector.endRun(runId, output?, metadata?)
collector.errorRun(runId, error)
collector.getSessions()                // → TraceSession[]
collector.getMetrics(sessionId?)       // → TraceMetrics
collector.getTimeSeriesData(options?)
collector.subscribe(listener)          // → unsubscribe fn
collector.clear()
collector.export()                     // → JSON string
collector.import(json)

resetCollector();  // destroy the global instance (useful in tests)
```

---

### `createDevToolsHook()`

Creates an `ObservabilityHook` that bridges `@orka-js/observability`'s `Tracer` events into DevTools trace sessions.

---

### `createTracerWithDevTools(options?)`

Convenience factory that returns both the hook and a ready-to-use `Tracer` config object.

```typescript
const { hook, config } = createTracerWithDevTools({ logLevel: 'info' });
```

---

### `OpenTelemetryExporter`

Export traces to any OTLP-compatible backend (Jaeger, Zipkin, Honeycomb, Grafana Tempo, etc.).

```typescript
import { OpenTelemetryExporter, createOTLPExporter } from '@orka-js/devtools';

const exporter = createOTLPExporter({
  endpoint: 'http://localhost:4318/v1/traces',
  headers: { 'x-api-key': process.env.OTLP_KEY },
});
```

---

### `ReplayDebugger`

Replay and compare historical trace runs to test prompt changes or regressions.

```typescript
import { ReplayDebugger, createReplayDebugger } from '@orka-js/devtools';

const debugger = createReplayDebugger(tracer);
const comparison = await debugger.replayRun({
  runId: 'run-abc',
  sessionId: 'session-xyz',
  modifyInput: (input) => ({ ...input, prompt: 'Updated prompt' }),
});
console.log(comparison.diff);
```

---

### Server components

| Export | Description |
|--------|-------------|
| `DevToolsServer` | HTTP + WebSocket server that serves the local dashboard UI |
| `RemoteAgent` | Forwards local traces to a remote collector endpoint |
| `RemoteViewer` | Listens to a remote collector and feeds traces into the local dashboard |

## Related Packages

- [`@orka-js/core`](../core) — Core types
- [`@orka-js/observability`](../observability) — `Tracer` and `ObservabilityHook` interfaces
- [`@orka-js/collector`](../collector) — Backward-compatible alias for this package
- [`orkajs`](../orkajs) — Full bundle
