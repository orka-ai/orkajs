# @orka-js/collector

Backward-compatible alias for `@orka-js/devtools` — trace collection for OrkaJS agents.

> **Note:** This package re-exports everything from [`@orka-js/devtools`](../devtools). For new projects, import from `@orka-js/devtools` directly. `@orka-js/collector` will continue to work but the `collector` function alias is deprecated and will be removed in v4.0.

## Installation

```bash
npm install @orka-js/collector
```

## Quick Start

```typescript
import { devtools, trace, withTrace, Trace } from '@orka-js/collector';

// Start the local dashboard
const { tracer, stop } = await devtools({ source: 'local', port: 3001 });

// Trace any async work
const runId = trace.start('agent', 'my-agent', { query: 'Hello' });
const result = await myAgent.run('Hello');
trace.end(runId, result);

await stop();
```

The `collector` export is also available as a direct alias for `devtools`:

```typescript
import { collector } from '@orka-js/collector';

// Identical to calling devtools()
const { tracer, stop } = await collector({ source: 'local' });
```

## API

All exports are re-exported from `@orka-js/devtools`. Refer to the [`@orka-js/devtools` README](../devtools/README.md) for the complete API reference, including:

- `devtools(config?)` — start DevTools (local dashboard or remote agent/viewer)
- `collector` — alias for `devtools` *(deprecated, use `devtools` instead)*
- `trace` — manual tracing helpers (`trace.start`, `trace.end`, `trace.error`, `trace.session`, `trace.wrap`)
- `withTrace(fn, options?)` — wrap a function with automatic tracing
- `@Trace(options?)` — decorator for class methods
- `TraceCollector`, `getCollector()`, `resetCollector()` — low-level collector
- `createDevToolsHook()`, `createTracerWithDevTools()` — observability integration
- `OpenTelemetryExporter`, `createOTLPExporter()` — OTLP export
- `ReplayDebugger`, `createReplayDebugger()` — trace replay and comparison
- `DevToolsServer`, `RemoteAgent`, `RemoteViewer` — server components

## Migrating to `@orka-js/devtools`

Replace the import and remove the `collector` alias:

```diff
- import { collector, trace } from '@orka-js/collector';
- const { tracer, stop } = await collector({ source: 'local' });
+ import { devtools, trace } from '@orka-js/devtools';
+ const { tracer, stop } = await devtools({ source: 'local' });
```

Everything else — `trace`, `withTrace`, `@Trace`, `TraceCollector`, etc. — is identical between the two packages.

## Related Packages

- [`@orka-js/devtools`](../devtools) — The package this is an alias for (prefer this for new projects)
- [`@orka-js/core`](../core) — Core types
- [`@orka-js/observability`](../observability) — `Tracer` and hooks
- [`orkajs`](../orkajs) — Full bundle
