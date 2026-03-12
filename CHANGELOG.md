# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-03-12

### 🚀 Major Release: Monorepo Architecture

OrkaJS is now a **monorepo** with 21 independently installable packages under the `@orka-js/*` scope.

### Breaking Changes

- **Package structure**: OrkaJS is now distributed as scoped packages (`@orka-js/*`)
- **Imports**: Tree-shakeable imports changed from `orkajs/adapters/openai` to `@orka-js/openai`
- The `orkajs` meta-package still works and re-exports everything

### Migration Guide

**Before (v1.x/v2.x):**
```typescript
import { createOrka } from 'orkajs';
import { OpenAIAdapter } from 'orkajs/adapters/openai';
import { MemoryVectorAdapter } from 'orkajs/adapters/memory';
```

**After (v3.0.0):**
```typescript
// Option 1: Full package (no changes needed)
import { createOrka, OpenAIAdapter, MemoryVectorAdapter } from 'orkajs';

// Option 2: Selective packages (smaller bundles)
import { createOrka } from '@orka-js/core';
import { OpenAIAdapter } from '@orka-js/openai';
import { MemoryVectorAdapter } from '@orka-js/memory';
```

### Added

- **21 scoped packages** for selective installation:
  - `@orka-js/core` - Types, errors, utils, Knowledge
  - `@orka-js/openai`, `@orka-js/anthropic`, `@orka-js/mistral`, `@orka-js/ollama` - LLM adapters
  - `@orka-js/memory`, `@orka-js/pinecone`, `@orka-js/qdrant`, `@orka-js/chroma` - Vector DB adapters
  - `@orka-js/agent` - Agents (ReAct, PlanAndExecute, HITL, Toolkits)
  - `@orka-js/tools` - Loaders, splitters, retrievers, parsers, chains, templates
  - `@orka-js/cache` - MemoryCache, RedisCache, CachedLLM, CachedEmbeddings
  - `@orka-js/resilience` - Retry, fallback, ResilientLLM
  - `@orka-js/orchestration` - RouterLLM, ConsensusLLM, RaceLLM, LoadBalancerLLM
  - `@orka-js/workflow` - Multi-step workflows
  - `@orka-js/graph` - Graph-based workflows
  - `@orka-js/evaluation` - Metrics, assertions, reporters, test runner
  - `@orka-js/observability` - Tracer, hooks, logging
  - `@orka-js/prompts` - Prompt registry, versioning, persistence
  - `@orka-js/memory-store` - Conversation memory (single + multi-session)
- **Turborepo** for optimized builds
- **Changesets** for versioning and publishing
- `CONTRIBUTING.md` and `DEVELOPMENT.md` guides

### Improved

- **Smaller bundle sizes** when using selective packages
- **Faster installs** by installing only what you need
- **Better tree-shaking** with ESM-first package structure

---

## [1.4.0] - 2026-03-09

### Added
- **Human-in-the-Loop (HITL) Agent** - Full support for human oversight in agent workflows
  - `HITLAgent` - Agent with built-in interrupt and checkpoint capabilities
  - `MemoryCheckpointStore` - In-memory checkpoint storage for development
  - Tool approval system with `requireApprovalFor` and `autoApproveTools` configuration
  - Checkpoint system with configurable intervals (`checkpointEvery`)
  - Resume from checkpoint support for long-running tasks
  - Interrupt types: `tool_approval`, `checkpoint`, `review`, `confirmation`, `custom`
  - Response types: `approved`, `rejected`, `modified`, `timeout`
  - Custom `CheckpointStore` interface for Redis/PostgreSQL persistence
  - `requestConfirmation()` and `requestReview()` methods for manual interrupts
- New subpath export: `orkajs/agent/hitl`
- Documentation: Human-in-the-Loop page added (EN/FR)

## [1.3.2] - 2026-03-07

### Added
- Full compatibility with `moduleResolution: "node"` (legacy mode)
- Generated proxy files at package root for all subpath exports 
- Support for all TypeScript module resolution modes: `"node"`, `"node16"`, `"nodenext"`, `"bundler"`

### Fixed
- Module resolution now works with legacy `moduleResolution: "node"` configuration
- Improved compatibility with existing TypeScript projects

## [1.3.0] - 2026-10-15
- Added support for TypeScript 5.9
- Cleaned up architectural migration

## [1.2.1] - 2026-10-15
- Refined module imports to fix issues

## [1.2.0] - 2026-10-15

### Added
- Fix issue importing modules

## [1.0.1] - 2026-10-15

### Fixed
- Fixed Discord link in README

## [1.0.0] - 2026-03-02

### Added

#### Core
- `createOrka()` - Main entry point with intent-based API
- `orka.ask()` - RAG-powered Q&A with automatic context retrieval
- `orka.generate()` - Direct LLM generation
- `orka.knowledge.create()` - Knowledge base creation with automatic chunking
- `orka.knowledge.search()` - Semantic search with metadata filtering

#### LLM Adapters
- `OpenAIAdapter` - GPT-4, GPT-4o, GPT-4o-mini with multimodal support
- `AnthropicAdapter` - Claude 3.5 Sonnet, Claude 3 Opus with vision
- `MistralAdapter` - Mistral Large, Medium, Small
- `OllamaAdapter` - Local models (Llama, Mistral, etc.)

#### Vector Database Adapters
- `MemoryVectorAdapter` - In-memory for development
- `PineconeAdapter` - Pinecone cloud vector database
- `QdrantAdapter` - Qdrant vector database
- `ChromaAdapter` - Chroma vector database

#### Agents
- `orka.agent()` - Structured agents with tools and policies
- `ReActAgent` - Reasoning + Acting loop
- `PlanAndExecuteAgent` - Plan first, execute steps
- `OpenAIFunctionsAgent` - JSON function calling format
- `StructuredChatAgent` - JSON in/out with schema validation
- `SQLToolkit` - SQL database interaction tools
- `CSVToolkit` - CSV file analysis tools

#### Workflows
- `orka.workflow()` - Multi-step pipelines
- Built-in steps: `plan()`, `retrieve()`, `generate()`, `verify()`, `improve()`, `custom()`
- `orka.graph()` - Graph-based workflows with conditional branching
- Node types: `startNode`, `endNode`, `actionNode`, `conditionNode`, `llmNode`, `retrieveNode`
- Mermaid diagram export via `graph.toMermaid()`

#### Memory
- `orka.memory()` - Single conversation memory
- `orka.sessions()` - Multi-user session management with TTL
- Strategies: `sliding_window`, `buffer`, `summary`

#### Evaluation
- `orka.evaluate()` - Built-in evaluation system
- Metrics: `relevance`, `correctness`, `faithfulness`, `hallucination`, `coherence`, `conciseness`
- `TestRunner` - CI/CD integration with assertions
- Reporters: Console, JSON, JUnit

#### Orchestration
- `RouterLLM` - Route requests by condition
- `ConsensusLLM` - Best-of-N with judge
- `RaceLLM` - Fastest response wins
- `LoadBalancerLLM` - Round-robin, weighted, random distribution

#### Resilience
- `withRetry()` - Exponential backoff retry
- `FallbackLLM` - Multi-provider fallback chain
- `ResilientLLM` - Wrapper with automatic retry
- Timeout support on all adapters via `timeoutMs`

#### Caching
- `MemoryCache` - In-memory LRU cache
- `RedisCache` - Redis-backed cache with TTL
- `CachedLLM` - LLM response caching
- `CachedEmbeddings` - Embedding caching

#### Document Processing
- **Loaders**: Text, CSV, JSON, Markdown, PDF, Directory
- **Splitters**: RecursiveCharacter, Markdown, Code, Token
- **Retrievers**: Vector, MultiQuery, ContextualCompression, Ensemble, ParentDocument, SelfQuery, BM25
- **Parsers**: JSON, Structured (Zod), List, AutoFix, XML, CSV, CommaSeparatedList

#### Chains
- `RetrievalQAChain` - RAG Q&A
- `ConversationalRetrievalChain` - Chat with memory
- `SummarizationChain` - Document summarization
- `QAChain` - Simple Q&A

#### Templates
- `PromptTemplate` - Variable substitution
- `ChatPromptTemplate` - Multi-message templates
- `FewShotPromptTemplate` - Example-based prompts

#### Observability
- `Tracer` - Trace LLM calls with hooks
- Event hooks: `onTraceStart`, `onTraceEnd`, `onEvent`, `onError`
- Memory leak protection with `maxTraces` and `traceTtlMs`

#### Prompt Versioning
- `PromptRegistry` - Version control for prompts
- `FilePersistence` - File-based prompt storage
- Diff and rollback support

#### Security
- SQL injection protection in `SQLToolkit`
- SSRF protection for URL fetching
- Secure ID generation with `crypto.randomBytes()`

### Security
- All adapters support `timeoutMs` with AbortController
- SHA-256 hashing for cache keys
- Input validation on all public APIs

---

## [0.1.0] - 2026-01-15

### Added
- Initial development release
- Basic RAG functionality
- OpenAI adapter prototype
