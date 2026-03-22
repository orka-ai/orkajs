# @orka-js/collector

## 1.1.3

### Patch Changes

- @orka-js/devtools@1.4.3

## 1.1.2

### Patch Changes

- @orka-js/devtools@1.4.2

## 1.1.0

### Minor Changes

- e844452: feat(devtools): Add remote tracing support for production debugging

  ## Breaking Changes

  - `devtools()` now returns `{ tracer, server, stop, config }` instead of `{ collector, server, stop }`
  - The `collector` property is renamed to `tracer` for industry alignment

  ## New Features

  - **Remote Tracing**: Debug AI apps in production with centralized trace collection

    - `source: 'local' | 'remote'` - Choose between local dashboard or remote collector
    - `mode: 'agent' | 'viewer'` - Send traces (agent) or receive traces (viewer)
    - `RemoteAgent` class: Batched trace uploads with configurable sampling
    - `RemoteViewer` class: Real-time SSE streaming of production traces

  - **New Configuration Options**:

    - `remote.endpoint` - Remote collector URL
    - `remote.apiKey` - Authentication token
    - `remote.projectId` - Project identifier
    - `remote.environment` - Environment tag (development/staging/production)
    - `remote.sampling` - Sampling rate (0-1) for production tracing
    - `remote.filters` - Viewer filters (userId, traceId, timeRange, etc.)

  - **New Package**: `@orka-js/collector` - Re-exports `@orka-js/devtools` for semantic clarity

  ## Migration

  ```typescript
  // Before
  const { collector, server, stop } = await devtools();

  // After
  const { tracer, server, stop } = await devtools();
  ```

  ## Usage Examples

  ```typescript
  // Local development (default)
  const { tracer } = await devtools({ source: "local", port: 3001 });

  // Production agent
  const { tracer } = await devtools({
    source: "remote",
    mode: "agent",
    remote: {
      endpoint: "https://traces.mycompany.com",
      apiKey: process.env.COLLECTOR_API_KEY,
      sampling: 0.1,
    },
  });

  // Remote viewer
  const { tracer, server } = await devtools({
    source: "remote",
    mode: "viewer",
    remote: {
      endpoint: "https://traces.mycompany.com",
      filters: { environment: "production" },
    },
  });
  ```

### Patch Changes

- Updated dependencies [e844452]
  - @orka-js/devtools@1.4.0
