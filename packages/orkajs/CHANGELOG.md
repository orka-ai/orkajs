# orkajs

## 3.0.3

### Patch Changes

- Updated dependencies [16bc6c1]
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
