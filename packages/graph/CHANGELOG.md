# @orka-js/graph

## 1.3.0

### Minor Changes

- feat(graph): Add Tracer integration to StateGraph for automatic observability
  feat(devtools): Add advanced analytics dashboard with Chart.js (type distribution, tokens/cost by model charts)
  feat(devtools): Add /api/metrics/timeline endpoint for time series data

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @orka-js/core@1.3.3

## 1.2.5

### Patch Changes

- fix: Eliminate silent failures, standardize OrkaError, add embed timeout to RaceLLM

  - **agent**: Listener errors in `BaseAgent.emit()` are now logged via `console.warn` instead of being silently swallowed — failures are visible without breaking agent flow
  - **orchestration**: `RaceLLM.embed()` now has a global timeout (was missing, could hang indefinitely); all constructors and runtime errors now throw `OrkaError` with structured codes (`INVALID_CONFIG`, `LLM_TIMEOUT`, `LLM_API_ERROR`) and metadata (adapter names, timeout value, failure details)
  - **graph**: All `StateGraph` errors now throw `OrkaError` with proper codes (`GRAPH_INVALID_CONFIG`, `GRAPH_NODE_ERROR`, `GRAPH_MAX_ITERATIONS`, `NOT_FOUND`) and `nodeId`/`checkpointId` in metadata for easier debugging
  - **workflow**: `Workflow` step failures now throw `OrkaError(EXTERNAL_SERVICE_ERROR)` preserving the original error as `cause` with `stepName` and `attempts` in metadata

## 1.2.4

### Patch Changes

- Fix: Replace workspace:\* dependencies with actual npm versions

  This fixes a critical bug where packages were published with workspace:\*
  dependencies that cannot be resolved when installed from npm.

## 1.2.3

### Patch Changes

- Updated dependencies
  - @orka-js/core@1.3.2

## 1.2.2

### Patch Changes

- Updated dependencies [93651a4]
  - @orka-js/core@1.3.1

## 1.2.1

### Patch Changes

- Updated dependencies [674e66d]
  - @orka-js/core@1.3.0

## 1.2.0

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

## 1.1.1

### Patch Changes

- Updated dependencies
  - @orka-js/core@1.2.1

## 1.1.0

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

## 1.0.2

### Patch Changes

- Updated dependencies [897bfff]
  - @orka-js/core@1.2.0

## 1.0.1

### Patch Changes

- Updated dependencies [16bc6c1]
  - @orka-js/core@1.1.0

## 1.0.0

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
