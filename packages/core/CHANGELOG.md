# @orka-js/core

## 1.4.0

### Minor Changes

- Add structured outputs with `ZodLikeSchema<T>`, typed `generate<T>()` and `ask<T>()` overloads, `PostgresCheckpointStore` and `RedisCheckpointStore` for StateGraph persistent checkpointing

## 1.4.0

### Minor Changes

- Add structured outputs with `ZodLikeSchema<T>`, typed `generate<T>()` and `ask<T>()` overloads, `PostgresCheckpointStore` and `RedisCheckpointStore` for StateGraph persistent checkpointing

## 1.3.3

### Patch Changes

- fix(types): Ensure LLMResult.cost field is properly exported in type definitions
- feat(graph): Add Tracer integration to StateGraph for automatic observability
  feat(devtools): Add advanced analytics dashboard with Chart.js (type distribution, tokens/cost by model charts)
  feat(devtools): Add /api/metrics/timeline endpoint for time series data

## 1.3.2

### Patch Changes

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

## 1.3.1

### Patch Changes

- 93651a4: feat(core): Add new error codes for MCP and fine-tuning

  - NOT_FOUND: Resource not found errors
  - INVALID_INPUT: Invalid input validation errors
  - INVALID_STATE: Invalid state errors
  - NETWORK_ERROR: Network connectivity errors
  - EXTERNAL_SERVICE_ERROR: External service errors
  - Add isRetryable() instance method to OrkaError

## 1.3.0

### Minor Changes

- 674e66d: ## Streaming & Callbacks (P1)

  ### CallbackManager - Centralized Event Handling

  New `CallbackManager` class for centralized callback management across all OrkaJS components:

  **Features:**

  - Token-level callbacks: `onTokenStart`, `onToken`, `onTokenEnd`
  - Tool execution tracking: `onToolStart`, `onToolEnd`, `onToolError`
  - Agent lifecycle events: `onAgentAction`, `onAgentObservation`, `onAgentFinish`, `onAgentError`
  - Chain events: `onChainStart`, `onChainEnd`, `onChainError`
  - LLM events: `onLLMStart`, `onLLMEnd`, `onLLMError`
  - Retrieval events: `onRetrievalStart`, `onRetrievalEnd`
  - Async callback support with error isolation
  - Event filtering by type
  - Global and local manager instances
  - Child managers for isolated scopes

  **Usage:**

  ```typescript
  import { getCallbackManager, createCallbackHandler } from "@orka-js/core";

  const handler = createCallbackHandler("my-handler", {
    onToken: (token, index, content) => {
      process.stdout.write(token);
    },
    onToolStart: (event) => {
      console.log(`Tool ${event.toolName} started`);
    },
    onAgentFinish: (event) => {
      console.log(`Agent completed in ${event.durationMs}ms`);
    },
  });

  getCallbackManager().addHandler(handler);
  ```

  ### Agent Integration

  - Agents now automatically emit events to the global `CallbackManager`
  - Optional `callbackManager` config option for custom managers
  - All tool executions and agent actions are tracked

  ### Built-in Handlers

  - `consoleCallbackHandler` - Debug logging to console

## 1.2.1

### Patch Changes

- feat: add new LLM providers and streaming RAG

  - @orka-js/google: Google AI (Gemini) adapter with streaming support
  - @orka-js/cohere: Cohere adapter with streaming support
  - @orka-js/replicate: Replicate adapter with streaming support
  - @orka-js/core: Add Orka class with ask(), streamAsk(), streamAskComplete() for streaming RAG

## 1.2.0

### Minor Changes

- 897bfff: feat: Add real-time token streaming for all LLM adapters

  - Add streaming types and utilities in @orka-js/core (StreamingLLMAdapter, LLMStreamEvent, StreamResult, etc.)
  - Implement stream() and streamGenerate() methods for OpenAI, Anthropic, Mistral, and Ollama adapters
  - Support for token-by-token streaming with onToken and onEvent callbacks
  - Time to First Token (TTFT) tracking for performance monitoring
  - AbortController support for stream cancellation
  - Extended thinking support for Claude models (ThinkingEvent)
  - Event types: token, content, tool_call, thinking, usage, done, error
  - Helper functions: isStreamingAdapter(), createStreamEvent(), consumeStream(), parseSSEStream()

## 1.1.0

### Minor Changes

- 16bc6c1: feat(core): add PII Guard - Data Protection Layer for RGPD compliance

  - Added `PIIGuard` class for detecting and redacting sensitive information
  - Detects: emails, phone numbers, credit cards, SSN, IBAN, IP addresses, dates of birth
  - Configurable detection types and confidence thresholds
  - Type-specific placeholders: `[EMAIL]`, `[PHONE]`, `[CREDIT_CARD]`, etc.
  - Custom patterns support for organization-specific PII
  - Allow list to exclude specific patterns from redaction
  - `redactBeforeLLM` option for automatic protection before API calls
  - `throwOnPII` option for strict mode (throws error instead of redacting)
  - Callback `onPIIDetected` for logging/monitoring
  - Convenience functions: `redactPII()`, `detectPII()`, `createPIIGuard()`
  - New error code: `PII_DETECTED`

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
