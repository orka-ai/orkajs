---
"orkajs": major
"@orka-js/core": major
"@orka-js/openai": major
"@orka-js/anthropic": major
"@orka-js/mistral": major
"@orka-js/ollama": major
"@orka-js/memory": major
"@orka-js/pinecone": major
"@orka-js/qdrant": major
"@orka-js/chroma": major
"@orka-js/agent": major
"@orka-js/tools": major
"@orka-js/cache": major
"@orka-js/resilience": major
"@orka-js/orchestration": major
"@orka-js/workflow": major
"@orka-js/graph": major
"@orka-js/evaluation": major
"@orka-js/observability": major
"@orka-js/prompts": major
"@orka-js/memory-store": major
---

## OrkaJS v2.0.0 — Monorepo Migration

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

| Before (v1.x) | After (v2.0) |
|---|---|
| `import { OpenAIAdapter } from 'orkajs'` | `import { OpenAIAdapter } from '@orka-js/openai'` |
| `import { MemoryCache } from 'orkajs'` | `import { MemoryCache } from '@orka-js/cache'` |
| `import { ReActAgent } from 'orkajs'` | `import { ReActAgent } from '@orka-js/agent'` |
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
