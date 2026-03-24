# orkajs

## 3.6.3

### Patch Changes

- Updated dependencies [be311e8]
- Updated dependencies [be311e8]
  - @orka-js/agent@1.4.0
  - @orka-js/memory-store@1.2.0

## 3.6.2

### Patch Changes

- Updated dependencies
  - @orka-js/devtools@1.5.0

## 3.6.1

### Patch Changes

- Updated dependencies
  - @orka-js/agent@1.3.0

## 3.6.0

### Minor Changes

- feat(agent): Add Agent Platform with Identity, Registry, and Fleet Management

  ## New Features

  ### Agent Identity & Metadata

  - `AgentIdentity` interface with id, name, role, version, description, and metadata
  - `AgentMetadata` interface with tags, capabilities, author, and custom properties
  - Semantic versioning validation for agent versions

  ### Agent Registry

  - `AgentRegistry` class for centralized agent management
  - Full CRUD operations: `register()`, `get()`, `update()`, `delete()`
  - Advanced querying with `list()` and `query()` methods
  - Filter by tags, capabilities, role, author, or search text
  - `getStats()` for registry statistics (total agents, by type, popular tags/capabilities)
  - `export()` and `import()` for backup and migration
  - `globalAgentRegistry` singleton for application-wide usage

  ### Error Codes

  - Added `AGENT_ALREADY_EXISTS` and `AGENT_NOT_FOUND` error codes to OrkaErrorCode enum

  ## Usage

  ```typescript
  import { AgentRegistry } from "@orka-js/agent";

  const registry = new AgentRegistry();

  // Register an agent
  await registry.register(
    {
      id: "sales-assistant",
      name: "Sales Assistant",
      role: "Lead qualification",
      version: "1.0.0",
      description: "Handles customer inquiries",
      metadata: {
        tags: ["sales", "customer-facing"],
        capabilities: ["email", "crm-integration"],
      },
    },
    agentConfig,
    "react"
  );

  // Query agents
  const salesAgents = registry.query({ tags: ["sales"] });

  // Get statistics
  const stats = registry.getStats();
  ```

### Patch Changes

- Updated dependencies
  - @orka-js/agent@1.2.0
  - @orka-js/core@1.3.2
  - @orka-js/anthropic@1.1.4
  - @orka-js/cache@1.0.6
  - @orka-js/chroma@1.0.6
  - @orka-js/devtools@1.4.3
  - @orka-js/evaluation@1.0.6
  - @orka-js/finetuning@1.1.1
  - @orka-js/graph@1.2.3
  - @orka-js/mcp@1.1.1
  - @orka-js/memory@1.0.6
  - @orka-js/memory-store@1.1.3
  - @orka-js/mistral@1.1.4
  - @orka-js/observability@1.0.6
  - @orka-js/ocr@1.1.5
  - @orka-js/ollama@1.1.4
  - @orka-js/openai@1.2.2
  - @orka-js/orchestration@1.0.6
  - @orka-js/pinecone@1.0.6
  - @orka-js/prompts@1.0.6
  - @orka-js/qdrant@1.0.6
  - @orka-js/resilience@1.0.6
  - @orka-js/tools@1.2.3
  - @orka-js/workflow@1.0.6

## 3.5.0

### Minor Changes

- 93651a4: feat(finetuning): Add Fine-tuning Orchestration package

  - DatasetValidator: Validate JSONL datasets for fine-tuning compatibility
  - FineTuningOrchestrator: Create, monitor, and manage fine-tuning jobs
  - FeedbackCollector: Collect user feedback and convert to training datasets
  - Multi-provider support: OpenAI, Anthropic, Mistral, Together, Anyscale
  - Cost estimation before training
  - Model versioning and tracking

- 93651a4: feat(mcp): Add Model Context Protocol (MCP) package

  - MCPClient: Connect to MCP servers, list/call tools, read resources, get prompts
  - MCPServer: Expose tools, resources, and prompts via MCP protocol
  - MCPGateway: Route requests to multiple upstream MCP servers with health checks
  - Full JSON-RPC 2.0 implementation
  - Event system for monitoring tool calls and results
  - Authentication support via API keys

### Patch Changes

- Updated dependencies [93651a4]
- Updated dependencies [93651a4]
- Updated dependencies [93651a4]
  - @orka-js/finetuning@1.1.0
  - @orka-js/mcp@1.1.0
  - @orka-js/core@1.3.1
  - @orka-js/agent@1.1.3
  - @orka-js/anthropic@1.1.3
  - @orka-js/cache@1.0.5
  - @orka-js/chroma@1.0.5
  - @orka-js/devtools@1.4.2
  - @orka-js/evaluation@1.0.5
  - @orka-js/graph@1.2.2
  - @orka-js/memory@1.0.5
  - @orka-js/memory-store@1.1.2
  - @orka-js/mistral@1.1.3
  - @orka-js/observability@1.0.5
  - @orka-js/ocr@1.1.4
  - @orka-js/ollama@1.1.3
  - @orka-js/openai@1.2.1
  - @orka-js/orchestration@1.0.5
  - @orka-js/pinecone@1.0.5
  - @orka-js/prompts@1.0.5
  - @orka-js/qdrant@1.0.5
  - @orka-js/resilience@1.0.5
  - @orka-js/tools@1.2.2
  - @orka-js/workflow@1.0.5

## 3.4.8

### Patch Changes

- Updated dependencies [e844452]
  - @orka-js/devtools@1.4.0

## 3.4.7

### Patch Changes

- Updated dependencies
  - @orka-js/devtools@1.3.1

## 3.4.6

### Patch Changes

- Updated dependencies
  - @orka-js/devtools@1.3.0

## 3.4.5

### Patch Changes

- Updated dependencies [19905d4]
  - @orka-js/openai@1.2.0

## 3.4.4

### Patch Changes

- Updated dependencies [674e66d]
  - @orka-js/core@1.3.0
  - @orka-js/agent@1.1.2
  - @orka-js/anthropic@1.1.2
  - @orka-js/cache@1.0.4
  - @orka-js/chroma@1.0.4
  - @orka-js/devtools@1.2.1
  - @orka-js/evaluation@1.0.4
  - @orka-js/graph@1.2.1
  - @orka-js/memory@1.0.4
  - @orka-js/memory-store@1.1.1
  - @orka-js/mistral@1.1.2
  - @orka-js/observability@1.0.4
  - @orka-js/ocr@1.1.3
  - @orka-js/ollama@1.1.2
  - @orka-js/openai@1.1.2
  - @orka-js/orchestration@1.0.4
  - @orka-js/pinecone@1.0.4
  - @orka-js/prompts@1.0.4
  - @orka-js/qdrant@1.0.4
  - @orka-js/resilience@1.0.4
  - @orka-js/tools@1.2.1
  - @orka-js/workflow@1.0.4

## 3.4.3

### Patch Changes

- feat: add @orka-js/devtools to meta-package dependencies

  The DevTools package is now included in the orkajs meta-package, providing:

  - `devtools()` - Start the debugging dashboard
  - `trace` - Manual tracing helpers
  - `createDevToolsHook()` - Integration with Tracer
  - `createOTLPExporter()` - Export to Datadog/Grafana/Jaeger
  - `getReplayDebugger()` - Replay and compare traces

## 3.4.2

### Patch Changes

- Updated dependencies [774d61f]
  - @orka-js/memory-store@1.1.0
  - @orka-js/agent@1.1.1

## 3.4.1

### Patch Changes

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

## 3.4.0

### Minor Changes

- feat: P2 advanced features - time travel, hybrid search, multi-agent

  ### Time Travel Debugging (@orka-js/graph)

  - `StateGraphTimeTravel` class for debugging StateGraph executions
  - `getHistory()` - Get complete execution history with branches
  - `replayFrom()` - Replay execution from any checkpoint
  - `fork()` - Fork execution with modified state
  - `diff()` - Compare two checkpoints (state + path diff)
  - `getTimeline()` - Visualize execution timeline
  - `stepBack()` / `stepForward()` - Navigate checkpoints

  ### Hybrid Search & Reranking (@orka-js/tools)

  - `HybridRetriever` - Combines vector + BM25 keyword search with Reciprocal Rank Fusion
  - `Reranker` - LLM-based batch reranking with relevance scoring
  - `CrossEncoderReranker` - Pairwise cross-encoder style reranking
  - `CohereReranker` - Cohere Rerank API integration

  ### Multi-Agent Collaboration (@orka-js/agent)

  - `AgentTeam` - Orchestrate multiple agents working together
  - Collaboration strategies: supervisor, peer-to-peer, round-robin, consensus, hierarchical
  - Agent messaging system with broadcast support
  - Streaming team execution events

### Patch Changes

- Updated dependencies
  - @orka-js/graph@1.2.0
  - @orka-js/tools@1.2.0
  - @orka-js/agent@1.1.0

## 3.3.1

### Patch Changes

- feat: add new LLM providers and streaming RAG

  - @orka-js/google: Google AI (Gemini) adapter with streaming support
  - @orka-js/cohere: Cohere adapter with streaming support
  - @orka-js/replicate: Replicate adapter with streaming support
  - @orka-js/core: Add Orka class with ask(), streamAsk(), streamAskComplete() for streaming RAG

- Updated dependencies
  - @orka-js/core@1.2.1
  - @orka-js/agent@1.0.3
  - @orka-js/anthropic@1.1.1
  - @orka-js/cache@1.0.3
  - @orka-js/chroma@1.0.3
  - @orka-js/evaluation@1.0.3
  - @orka-js/graph@1.1.1
  - @orka-js/memory@1.0.3
  - @orka-js/memory-store@1.0.3
  - @orka-js/mistral@1.1.1
  - @orka-js/observability@1.0.3
  - @orka-js/ocr@1.1.2
  - @orka-js/ollama@1.1.1
  - @orka-js/openai@1.1.1
  - @orka-js/orchestration@1.0.3
  - @orka-js/pinecone@1.0.3
  - @orka-js/prompts@1.0.3
  - @orka-js/qdrant@1.0.3
  - @orka-js/resilience@1.0.3
  - @orka-js/tools@1.1.1
  - @orka-js/workflow@1.0.3

## 3.3.0

### Minor Changes

- feat(tools): add API-based loaders for external services

  - NotionLoader: Load pages and databases from Notion with rich text extraction
  - SlackLoader: Load channel messages with thread support and date filtering
  - GitHubLoader: Load repository files with path filtering and extension support
  - GoogleDriveLoader: Load files and folders with Google Docs export support

### Patch Changes

- Updated dependencies
  - @orka-js/tools@1.1.0

## 3.2.0

### Minor Changes

- feat(graph): add StateGraph with typed state, interrupts, and persistence

  - Add StateGraph class for building typed state machines
  - Support conditional edges based on state
  - Implement interrupt before/after nodes (human-in-the-loop)
  - Add checkpoint persistence with GraphCheckpointStore
  - Support resume from checkpoint with state updates
  - Add streaming execution with events
  - Include Mermaid diagram export
  - Add state reducers (appendList, increment, mergeObject, etc.)

### Patch Changes

- Updated dependencies
  - @orka-js/graph@1.1.0

## 3.1.1

### Patch Changes

- Updated dependencies [897bfff]
  - @orka-js/core@1.2.0
  - @orka-js/openai@1.1.0
  - @orka-js/anthropic@1.1.0
  - @orka-js/mistral@1.1.0
  - @orka-js/ollama@1.1.0
  - @orka-js/agent@1.0.2
  - @orka-js/cache@1.0.2
  - @orka-js/chroma@1.0.2
  - @orka-js/evaluation@1.0.2
  - @orka-js/graph@1.0.2
  - @orka-js/memory@1.0.2
  - @orka-js/memory-store@1.0.2
  - @orka-js/observability@1.0.2
  - @orka-js/ocr@1.1.1
  - @orka-js/orchestration@1.0.2
  - @orka-js/pinecone@1.0.2
  - @orka-js/prompts@1.0.2
  - @orka-js/qdrant@1.0.2
  - @orka-js/resilience@1.0.2
  - @orka-js/tools@1.0.2
  - @orka-js/workflow@1.0.2

## 3.1.0

### Minor Changes

- 19697a1: ## 🔍 OCR & Document Extraction Module

  New `@orka-js/ocr` package for extracting text from images, PDFs, and scanned documents.

  ### Features

  - **Multiple OCR Engines**

    - `TesseractEngine` - Local/self-hosted OCR (RGPD-friendly, no cloud dependency)
    - `OpenAIVisionEngine` - Cloud-based high-precision OCR using GPT-4 Vision

  - **Document Extraction with Schema**

    - Extract structured data from documents using a schema definition
    - Supports nested objects, arrays, and required fields
    - LLM-powered extraction for complex documents

  - **Rich Result Structure**
    - Full text extraction with confidence scores
    - Page-by-page results with blocks, lines, and words
    - Table extraction support
    - Form field extraction (key-value pairs)

  ### Usage

  ```typescript
  import { OCR, DocumentExtractor } from "@orka-js/ocr";

  // Basic OCR
  const ocr = new OCR(); // Uses Tesseract by default
  const result = await ocr.process("./document.png");

  // Cloud OCR with OpenAI Vision
  const ocr = new OCR({
    type: "openai-vision",
    config: { apiKey: process.env.OPENAI_API_KEY! },
  });

  // Structured extraction
  const extractor = new DocumentExtractor();
  const data = await extractor.extract({
    file: "./invoice.pdf",
    schema: {
      invoiceNumber: "string",
      total: "number",
      date: "date",
    },
    llm: myLLMAdapter,
  });
  ```

  ### Why OCR?

  60-80% of enterprise documents are not natively text-based (scanned PDFs, images, faxes). This module enables OrkaJS to process real-world business documents for RAG and AI workflows.

### Patch Changes

- Updated dependencies [19697a1]
- Updated dependencies [16bc6c1]
  - @orka-js/ocr@1.1.0
  - @orka-js/core@1.1.0
  - @orka-js/agent@1.0.1
  - @orka-js/anthropic@1.0.1
  - @orka-js/cache@1.0.1
  - @orka-js/chroma@1.0.1
  - @orka-js/evaluation@1.0.1
  - @orka-js/graph@1.0.1
  - @orka-js/memory@1.0.1
  - @orka-js/memory-store@1.0.1
  - @orka-js/mistral@1.0.1
  - @orka-js/observability@1.0.1
  - @orka-js/ollama@1.0.1
  - @orka-js/openai@1.0.1
  - @orka-js/orchestration@1.0.1
  - @orka-js/pinecone@1.0.1
  - @orka-js/prompts@1.0.1
  - @orka-js/qdrant@1.0.1
  - @orka-js/resilience@1.0.1
  - @orka-js/tools@1.0.1
  - @orka-js/workflow@1.0.1

## 3.0.2

### Patch Changes

- docs: include README.md in published package

## 3.0.1

### Patch Changes

- docs: update README and CONTRIBUTING with monorepo installation options

## 3.0.0

### Major Changes

- 431e216: ## OrkaJS v2.0.0 — Monorepo Migration

  ### Breaking Changes

  - **Architecture**: OrkaJS is now a monorepo with individual `@orka-js/*` scoped packages
  - **Selective installation**: Users can now install only the packages they need instead of the full bundle
  - **Subpath imports removed**: Old imports like `orkajs/adapters/openai` are replaced by `@orka-js/openai`

  ### New Installation Options

  ```bash
  # Option 1: Full bundle (backward compatible)
  npm install orkajs@2

  # Option 2: Selective installation (new)
  npm install @orka-js/core @orka-js/openai @orka-js/memory
  ```

  ### Migration Guide

  | Before (v1.x)                             | After (v2.0)                                      |
  | ----------------------------------------- | ------------------------------------------------- |
  | `import { OpenAIAdapter } from 'orkajs'`  | `import { OpenAIAdapter } from '@orka-js/openai'` |
  | `import { MemoryCache } from 'orkajs'`    | `import { MemoryCache } from '@orka-js/cache'`    |
  | `import { ReActAgent } from 'orkajs'`     | `import { ReActAgent } from '@orka-js/agent'`     |
  | `import { PromptTemplate } from 'orkajs'` | `import { PromptTemplate } from '@orka-js/tools'` |

  > **Note**: `import { ... } from 'orkajs'` still works — the meta-package re-exports everything.

  ### Packages

  - `@orka-js/core` — Types, errors, utils, chunker, knowledge
  - `@orka-js/openai` / `anthropic` / `mistral` / `ollama` — LLM adapters
  - `@orka-js/memory` / `pinecone` / `qdrant` / `chroma` — VectorDB adapters
  - `@orka-js/agent` — ReAct, PlanAndExecute, OpenAIFunctions, StructuredChat, HITL, Toolkits
  - `@orka-js/tools` — Loaders, splitters, retrievers, parsers, chains, templates
  - `@orka-js/cache` — MemoryCache, RedisCache, CachedLLM, CachedEmbeddings
  - `@orka-js/resilience` — Retry, fallback, ResilientLLM
  - `@orka-js/orchestration` — RouterLLM, ConsensusLLM, RaceLLM, LoadBalancerLLM
  - `@orka-js/workflow` — Multi-step workflows
  - `@orka-js/graph` — Graph-based workflows
  - `@orka-js/evaluation` — Metrics, assertions, reporters, test runner
  - `@orka-js/observability` — Tracer, hooks, logging
  - `@orka-js/prompts` — Prompt registry, versioning, persistence
  - `@orka-js/memory-store` — Conversation memory (single + multi-session)

### Patch Changes

- Updated dependencies [431e216]
  - @orka-js/core@1.0.0
  - @orka-js/openai@1.0.0
  - @orka-js/anthropic@1.0.0
  - @orka-js/mistral@1.0.0
  - @orka-js/ollama@1.0.0
  - @orka-js/memory@1.0.0
  - @orka-js/pinecone@1.0.0
  - @orka-js/qdrant@1.0.0
  - @orka-js/chroma@1.0.0
  - @orka-js/agent@1.0.0
  - @orka-js/tools@1.0.0
  - @orka-js/cache@1.0.0
  - @orka-js/resilience@1.0.0
  - @orka-js/orchestration@1.0.0
  - @orka-js/workflow@1.0.0
  - @orka-js/graph@1.0.0
  - @orka-js/evaluation@1.0.0
  - @orka-js/observability@1.0.0
  - @orka-js/prompts@1.0.0
  - @orka-js/memory-store@1.0.0
