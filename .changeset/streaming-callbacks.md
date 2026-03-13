---
"@orka-js/core": minor
"@orka-js/agent": patch
---

## Streaming & Callbacks (P1)

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
import { getCallbackManager, createCallbackHandler } from '@orka-js/core';

const handler = createCallbackHandler('my-handler', {
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
