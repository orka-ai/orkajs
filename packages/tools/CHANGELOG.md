# @orka-js/tools

## 1.2.7

### Patch Changes

- chore: update packages
- Updated dependencies
  - @orka-js/core@1.5.1

## 1.2.6

### Patch Changes

- e4c8e29: feat(edge): replace Node.js crypto/Buffer with Web APIs for Edge runtime compatibility

  - `@orka-js/core` utils: `crypto.getRandomValues` instead of `randomBytes`
  - `@orka-js/cache` cached-llm: FNV-1a hash instead of `createHash('sha256')`
  - `@orka-js/agent` hitl-agent: `crypto.getRandomValues` instead of `crypto.randomBytes`
  - `@orka-js/tools` github-loader: `atob` + `TextDecoder` instead of `Buffer.from`

  All four packages now run in Vercel Edge and Cloudflare Workers without Node.js polyfills.

- Updated dependencies [e4c8e29]
- Updated dependencies [e4c8e29]
  - @orka-js/core@1.5.0

## 1.2.5

### Patch Changes

- Add structured outputs with `ZodLikeSchema<T>`, typed `generate<T>()` and `ask<T>()` overloads, `PostgresCheckpointStore` and `RedisCheckpointStore` for StateGraph persistent checkpointing
- Updated dependencies
  - @orka-js/core@1.4.0

## 1.2.5

### Patch Changes

- Add structured outputs with `ZodLikeSchema<T>`, typed `generate<T>()` and `ask<T>()` overloads, `PostgresCheckpointStore` and `RedisCheckpointStore` for StateGraph persistent checkpointing
- Updated dependencies
  - @orka-js/core@1.4.0

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

- feat(tools): add API-based loaders for external services

  - NotionLoader: Load pages and databases from Notion with rich text extraction
  - SlackLoader: Load channel messages with thread support and date filtering
  - GitHubLoader: Load repository files with path filtering and extension support
  - GoogleDriveLoader: Load files and folders with Google Docs export support

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
