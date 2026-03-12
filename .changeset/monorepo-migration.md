---
"orkajs": major
"@orkajs/core": major
"@orkajs/openai": major
"@orkajs/anthropic": major
"@orkajs/mistral": major
"@orkajs/ollama": major
"@orkajs/memory": major
"@orkajs/pinecone": major
"@orkajs/qdrant": major
"@orkajs/chroma": major
"@orkajs/agent": major
"@orkajs/tools": major
"@orkajs/cache": major
"@orkajs/resilience": major
"@orkajs/orchestration": major
"@orkajs/workflow": major
"@orkajs/graph": major
"@orkajs/evaluation": major
"@orkajs/observability": major
"@orkajs/prompts": major
"@orkajs/memory-store": major
---

## OrkaJS v2.0.0 — Monorepo Migration

### Breaking Changes

- **Architecture**: OrkaJS is now a monorepo with individual `@orkajs/*` scoped packages
- **Selective installation**: Users can now install only the packages they need instead of the full bundle
- **Subpath imports removed**: Old imports like `orkajs/adapters/openai` are replaced by `@orkajs/openai`

### New Installation Options

```bash
# Option 1: Full bundle (backward compatible)
npm install orkajs@2

# Option 2: Selective installation (new)
npm install @orkajs/core @orkajs/openai @orkajs/memory
```

### Migration Guide

| Before (v1.x) | After (v2.0) |
|---|---|
| `import { OpenAIAdapter } from 'orkajs'` | `import { OpenAIAdapter } from '@orkajs/openai'` |
| `import { MemoryCache } from 'orkajs'` | `import { MemoryCache } from '@orkajs/cache'` |
| `import { ReActAgent } from 'orkajs'` | `import { ReActAgent } from '@orkajs/agent'` |
| `import { PromptTemplate } from 'orkajs'` | `import { PromptTemplate } from '@orkajs/tools'` |

> **Note**: `import { ... } from 'orkajs'` still works — the meta-package re-exports everything.

### Packages

- `@orkajs/core` — Types, errors, utils, chunker, knowledge
- `@orkajs/openai` / `anthropic` / `mistral` / `ollama` — LLM adapters
- `@orkajs/memory` / `pinecone` / `qdrant` / `chroma` — VectorDB adapters
- `@orkajs/agent` — ReAct, PlanAndExecute, OpenAIFunctions, StructuredChat, HITL, Toolkits
- `@orkajs/tools` — Loaders, splitters, retrievers, parsers, chains, templates
- `@orkajs/cache` — MemoryCache, RedisCache, CachedLLM, CachedEmbeddings
- `@orkajs/resilience` — Retry, fallback, ResilientLLM
- `@orkajs/orchestration` — RouterLLM, ConsensusLLM, RaceLLM, LoadBalancerLLM
- `@orkajs/workflow` — Multi-step workflows
- `@orkajs/graph` — Graph-based workflows
- `@orkajs/evaluation` — Metrics, assertions, reporters, test runner
- `@orkajs/observability` — Tracer, hooks, logging
- `@orkajs/prompts` — Prompt registry, versioning, persistence
- `@orkajs/memory-store` — Conversation memory (single + multi-session)
