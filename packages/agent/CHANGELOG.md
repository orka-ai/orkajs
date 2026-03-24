# @orka-js/agent

## 1.4.1

### Patch Changes

- Fix: Replace workspace:\* dependencies with actual npm versions

  This fixes a critical bug where packages were published with workspace:\*
  dependencies that cannot be resolved when installed from npm.

- Updated dependencies
  - @orka-js/memory-store@1.2.1

## 1.4.0

### Minor Changes

- be311e8: Add compact_conversation tool for autonomous context compression

  - Add `createCompactConversationTool()` factory function
  - Agents can now autonomously decide when to compress conversation history
  - Add `COMPACT_CONVERSATION_PROMPT_ADDITION` for system prompt guidance
  - Tool returns detailed metrics: messages compressed, tokens saved, summary
  - Includes comprehensive documentation and usage examples

### Patch Changes

- Updated dependencies [be311e8]
  - @orka-js/memory-store@1.2.0

## 1.3.0

### Minor Changes

- feat(agent): Add Permissions & Access Control (RBAC) for enterprise governance

  ## New Features

  ### PermissionManager

  - Role-Based Access Control (RBAC) for agents
  - Permission actions: `read`, `execute`, `edit`, `clone`, `delete`, `admin`
  - Principal types: `user`, `team`, `role`, `service`
  - Conditional permissions: time ranges, IP whitelist, rate limits
  - Permission inheritance between agents
  - `grant()` and `revoke()` methods for dynamic permission management
  - `globalPermissionManager` singleton for application-wide usage

  ### AuditLogger

  - Full traceability of all agent-related actions
  - Event types: agent.registered, agent.updated, agent.deleted, agent.executed, agent.cloned, permission.granted, permission.revoked, access.allowed, access.denied
  - Query and filtering capabilities with `query()` method
  - Statistics with `getStats()`: events by type, top principals, top agents, access denied count
  - Real-time event subscription with `on()` / `off()`
  - Export to JSON and CSV for compliance
  - `globalAuditLogger` singleton for application-wide usage

  ### Team Management Types

  - `Team` interface for group management
  - `TeamRole` for role definitions within teams
  - `TeamMember` for user membership tracking

  ## Usage

  ```typescript
  import { PermissionManager, AuditLogger } from "@orka-js/agent";

  const permissions = new PermissionManager();
  const audit = new AuditLogger();

  // Set permissions
  permissions.setPermissions("sales-agent", {
    agentId: "sales-agent",
    owner: "user:admin",
    rules: [
      { action: "read", principals: ["team:sales", "team:marketing"] },
      { action: "execute", principals: ["role:sales-rep"] },
      { action: "edit", principals: ["role:admin"] },
    ],
  });

  // Register user memberships
  permissions.registerPrincipalMemberships("user:john", [
    "team:sales",
    "role:sales-rep",
  ]);

  // Check permission
  const result = permissions.check({
    principal: { type: "user", id: "john" },
    action: "execute",
    agentId: "sales-agent",
  });

  // Log execution
  if (result.allowed) {
    audit.logAgentExecuted(
      { type: "user", id: "john" },
      "sales-agent",
      "success"
    );
  }

  // Subscribe to events
  audit.on("access.denied", (event) => {
    console.warn(`Access denied: ${event.principal.id}`);
  });
  ```

## 1.2.0

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
  - @orka-js/core@1.3.2
  - @orka-js/memory-store@1.1.3

## 1.1.3

### Patch Changes

- Updated dependencies [93651a4]
  - @orka-js/core@1.3.1
  - @orka-js/memory-store@1.1.2

## 1.1.2

### Patch Changes

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

- Updated dependencies [674e66d]
  - @orka-js/core@1.3.0
  - @orka-js/memory-store@1.1.1

## 1.1.1

### Patch Changes

- Updated dependencies [774d61f]
  - @orka-js/memory-store@1.1.0

## 1.1.0

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

## 1.0.3

### Patch Changes

- Updated dependencies
  - @orka-js/core@1.2.1
  - @orka-js/memory-store@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [897bfff]
  - @orka-js/core@1.2.0
  - @orka-js/memory-store@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [16bc6c1]
  - @orka-js/core@1.1.0
  - @orka-js/memory-store@1.0.1

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
  - @orka-js/memory-store@1.0.0
