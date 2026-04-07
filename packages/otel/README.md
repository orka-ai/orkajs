# @orka-js/otel

OpenTelemetry exporter for OrkaJS — send agent traces to Jaeger, Tempo, Datadog, or any OTLP-compatible backend.

## Installation

```bash
npm install @orka-js/otel
```

## Quick Start

```typescript
import { createOtelExporter } from '@orka-js/otel'
import { Orka } from '@orka-js/core'

const exporter = createOtelExporter({
  endpoint: 'http://localhost:4318/v1/traces',
  serviceName: 'my-ai-app',
})

const orka = new Orka({
  llm,
  callbacks: {
    onStart: (run) => exporter.startSpan(run),
    onEnd: (run) => exporter.endSpan(run),
    onError: (run, err) => exporter.recordError(run, err),
  },
})
```

## With Headers (Datadog / Grafana Cloud)

```typescript
const exporter = createOtelExporter({
  endpoint: 'https://otlp.datadoghq.com/v1/traces',
  serviceName: 'my-ai-app',
  headers: {
    'DD-API-KEY': process.env.DD_API_KEY!,
  },
})
```

## W3C Trace Context Propagation

```typescript
import { traceContextPropagator } from '@orka-js/otel'

// Inject trace context into outgoing HTTP headers
const headers = {}
traceContextPropagator.inject(context, headers)

// Extract trace context from incoming HTTP headers
const ctx = traceContextPropagator.extract(headers)
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `endpoint` | `string` | OTLP HTTP endpoint (required) |
| `serviceName` | `string` | Service name for spans (required) |
| `headers` | `Record<string, string>` | Additional request headers |

## API

### `OtelExporter` / `createOtelExporter(config)`

```typescript
exporter.startSpan(run)           // Start a new span
exporter.endSpan(run)             // End a span
exporter.recordError(run, error)  // Record an exception
exporter.flush()                  // Force flush pending spans
```

### `W3CTraceContextPropagator`

```typescript
propagator.inject(context, carrier)   // Inject trace context into headers
propagator.extract(carrier)           // Extract trace context from headers
```

## Related Packages

- [`@orka-js/observability`](../observability) — Lightweight built-in tracer
- [`@orka-js/devtools`](../devtools) — Local DevTools UI
- [`@orka-js/core`](../core) — `CallbackManager` for lifecycle hooks
- [`orkajs`](../orkajs) — Full bundle
