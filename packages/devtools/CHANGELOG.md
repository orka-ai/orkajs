# @orka-js/devtools

## 1.5.0

### Minor Changes

- Add getTimeSeriesData() method to TraceCollector for extracting time series data for visualization

  - New `getTimeSeriesData()` method extracts latency, token, and cost data points over time
  - Supports filtering by sessionId and metric type (latency, tokens, cost, or all)
  - Returns sorted time series data ready for chart visualization
  - Synced @orka-js/collector version to 1.4.3 to match @orka-js/devtools

## 1.4.3

### Patch Changes

- Updated dependencies
  - @orka-js/core@1.3.2
  - @orka-js/observability@1.0.6

## 1.4.2

### Patch Changes

- Updated dependencies [93651a4]
  - @orka-js/core@1.3.1
  - @orka-js/observability@1.0.5

## 1.4.0

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

## 1.3.1

### Patch Changes

- fix(devtools): corriger le scroll dans le panneau Run Details

  - Le contenu long est maintenant scrollable verticalement
  - Bouton "Copy JSON" reste visible en bas (sticky)

## 1.3.0

### Minor Changes

- feat(devtools): amélioration majeure de l'interface DevTools Dashboard

  - Remplacement du logo SVG par le logo OrkaJS DevTools
  - Ajout du mode dark/light avec persistance localStorage
  - Raccourcis clavier (⌘K pour recherche, ⌘D pour thème)
  - 6 cartes de métriques avec icônes (Runs, Latency, Tokens, Errors, Cost, Sessions)
  - Panneau de détails des runs avec Input/Output/Metadata
  - Filtres par type (Agent, LLM, Tool, Chain, Retrieval)
  - Recherche en temps réel dans les traces
  - Toast notifications pour les événements
  - Command Palette pour recherche rapide
  - Animations fluides et scrollbar personnalisée
  - Architecture refactorisée avec fichier HTML externe

## 1.2.1

### Patch Changes

- Updated dependencies [674e66d]
  - @orka-js/core@1.3.0
  - @orka-js/observability@1.0.4

## 1.2.0

### Minor Changes

- feat(devtools): add OpenTelemetry export and Replay Debugging

  ### OpenTelemetry Export

  - `createOTLPExporter()` - Export traces to Datadog, Grafana, Jaeger, Zipkin
  - Automatic span creation with proper hierarchy
  - Configurable service name, version, and headers
  - Support for OTLP/HTTP protocol

  ### Replay Debugging

  - `getReplayDebugger()` - Access the replay debugger instance
  - `replay.replay()` - Re-execute traces with modified inputs
  - `replay.fork()` - Create branch points for A/B testing
  - `replay.compare()` - Compare two runs side-by-side
  - `replay.exportTestCase()` - Export traces as test cases

  ### Usage

  ```typescript
  import { createOTLPExporter, getReplayDebugger } from "@orka-js/devtools";

  // Export to Datadog/Grafana
  const exporter = createOTLPExporter({
    endpoint: "http://localhost:4318",
    serviceName: "my-app",
  });

  // Replay a trace with modifications
  const replay = getReplayDebugger();
  const result = await replay.replay({
    runId: "run-123",
    modifyInput: (input) => ({ ...input, temperature: 0.5 }),
  });
  ```

## 1.1.0

### Minor Changes

- 07c35a0: ## @orka-js/devtools v1.0.0 - Visual Debugging for LLM Applications

  New package providing real-time observability and debugging dashboard for OrkaJS.

  ### Features

  - **TraceCollector**: Collect and manage trace data with sessions, runs, and metrics
  - **DevToolsServer**: Express server with REST API + SSE for real-time updates
  - **Embedded Dashboard**: Beautiful UI with Tailwind CSS for trace visualization
  - **Tracer Integration**: `createDevToolsHook()` to bridge with `@orka-js/observability`

  ### Usage

  ```typescript
  import { devtools, trace } from "@orka-js/devtools";

  // Start the DevTools dashboard
  await devtools({ port: 3001 });

  // Trace your LLM calls
  await trace.wrap("agent", "research", async () => {
    return agent.run("Analyze market trends");
  });

  // Open http://localhost:3001 to see traces
  ```

  ### Integration with Tracer

  ```typescript
  import { Tracer } from "@orka-js/observability";
  import { createDevToolsHook, devtools } from "@orka-js/devtools";

  await devtools();

  const tracer = new Tracer({
    hooks: [createDevToolsHook()],
  });
  ```

  ### API

  - `devtools(config?)` - Start the dashboard server
  - `trace.start(type, name, input?, metadata?)` - Start a trace run
  - `trace.end(runId, output?, metadata?)` - End a trace run
  - `trace.error(runId, error)` - Mark a run as errored
  - `trace.wrap(type, name, fn, metadata?)` - Wrap an async function
  - `trace.session(name?)` - Start a new session
  - `@Trace({ type?, name? })` - Decorator for class methods
  - `withTrace(fn, options?)` - HOF wrapper for functions
