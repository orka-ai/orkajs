# @orka-js/observability

Lightweight observability and tracing utilities for OrkaJS agents.

## Installation

```bash
npm install @orka-js/observability
```

## Quick Start

```typescript
import { Tracer } from '@orka-js/observability'
import { Orka } from '@orka-js/core'

const tracer = new Tracer({
  onEvent: (event) => {
    console.log(`[${event.type}] ${event.name}`, event.data)
  },
})

const orka = new Orka({
  llm,
  callbacks: {
    onStart: (run) => tracer.start(run),
    onEnd: (run) => tracer.end(run),
    onError: (run, err) => tracer.error(run, err),
    onToken: (token) => tracer.token(token),
  },
})
```

## Log Levels

```typescript
import { Tracer, LogLevel } from '@orka-js/observability'

const tracer = new Tracer({
  level: LogLevel.DEBUG,
  onEvent: (event) => {
    if (event.level >= LogLevel.WARN) {
      alertingService.send(event)
    }
  },
})
```

## Trace Hooks

```typescript
import { ObservabilityHook } from '@orka-js/observability'

const hook: ObservabilityHook = {
  onStart: (trace) => { /* ... */ },
  onEnd: (trace) => { /* ... */ },
  onError: (trace, error) => { /* ... */ },
  onToken: (token, traceId) => { /* ... */ },
  onToolCall: (tool, args, traceId) => { /* ... */ },
}
```

## API

### `Tracer`

```typescript
new Tracer({ onEvent?, level? })

tracer.start(run)           // Begin trace
tracer.end(run)             // End trace
tracer.error(run, err)      // Record error
tracer.token(token)         // Record token
```

### Types

| Type | Description |
|------|-------------|
| `Trace` | Full trace object with id, name, events, duration |
| `TraceEvent` | Individual event within a trace |
| `ObservabilityHook` | Hook interface for trace lifecycle |
| `LogLevel` | `DEBUG \| INFO \| WARN \| ERROR` |

## Related Packages

- [`@orka-js/core`](../core) — `CallbackManager` for lifecycle hooks
- [`@orka-js/otel`](../otel) — OpenTelemetry exporter
- [`@orka-js/devtools`](../devtools) — Full DevTools UI
- [`orkajs`](../orkajs) — Full bundle
