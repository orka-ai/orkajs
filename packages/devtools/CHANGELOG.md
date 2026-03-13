# @orka-js/devtools

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
