---
"@orka-js/otel": minor
---

feat(otel): new standalone @orka-js/otel package

New Edge-compatible package for distributed tracing:
- `OtelExporter` — OTLP v1 JSON exporter with batching, auto-flush, and retry-on-failure
- `createOtelExporter(config)` — convenience factory
- `W3CTraceContextPropagator` — W3C `traceparent`/`tracestate` header injection and extraction
- `traceContextPropagator` — singleton for convenience

No runtime dependencies. Works in Node.js, Vercel Edge, and Cloudflare Workers.
