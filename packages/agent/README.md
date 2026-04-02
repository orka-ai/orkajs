# @orka-js/agent

Agent system for OrkaJS — ReAct, Plan-and-Execute, Streaming Tool Calls, HITL.

## Installation

```bash
npm install @orka-js/agent
```

## Agents

### StreamingToolAgent _(v1.5.0)_

Streams LLM tokens in real time **and** executes tool calls mid-stream. The user sees the model "thinking" while tools run in parallel.

```typescript
import { StreamingToolAgent } from '@orka-js/agent';
import { OpenAIAdapter } from '@orka-js/openai';

const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! });

const agent = new StreamingToolAgent({
  goal: 'Help customers with product questions',
  tools: [searchProductsTool, getDetailsTool],
}, llm);

// Stream tokens + tool results in real time
for await (const event of agent.runStream('Find me a bluetooth headphone under 200€')) {
  if (event.type === 'token') process.stdout.write(event.token);
  if (event.type === 'tool_result') console.log('\n[Tool]', event.result);
  if (event.type === 'done') console.log('\n[Done]', event.content);
}

// Or get a complete result
const result = await agent.run('Find me a bluetooth headphone under 200€');
console.log(result.output);
console.log(result.steps);      // Tool calls with observations
console.log(result.totalTokens);
```

**Config options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `goal` | `string` | — | Agent objective (injected in system prompt) |
| `tools` | `Tool[]` | `[]` | Tools the agent can call |
| `maxSteps` | `number` | `10` | Max tool-call iterations |
| `systemPrompt` | `string` | — | Additional system prompt text |
| `verbose` | `boolean` | `false` | Log tool calls to console |

**Stream events:**

| Event type | Description |
|-----------|-------------|
| `token` | Individual token from the LLM |
| `tool_call` | Tool invocation detected |
| `tool_result` | Tool execution result |
| `done` | Final answer, stream complete |
| `error` | Error occurred |

**With Memory (conversation persistence):**

```typescript
import { Memory } from '@orka-js/memory-store';

const memory = new Memory();

const agent = new StreamingToolAgent({ goal: '...', tools: [...] }, llm, memory);

// History is loaded automatically on each runStream() call
// and saved after completion
await agent.runStream('First message...');
await agent.runStream('Follow-up...');  // Has full context
```

---

### ReActAgent

Classic ReAct (Reason + Act) loop. Waits for the full response before executing tools.

```typescript
import { ReActAgent } from '@orka-js/agent';

const agent = new ReActAgent({ goal: '...', tools: [...] }, llm);
const result = await agent.run('What is the status of order ORD-123?');
```

### PlanAndExecuteAgent

Decomposes the goal into a plan before executing any tool.

```typescript
import { PlanAndExecuteAgent } from '@orka-js/agent';

const agent = new PlanAndExecuteAgent({ goal: '...', tools: [...] }, llm);
const result = await agent.run('Research and summarize the latest AI papers');
```

### HITLAgent _(Human-in-the-Loop)_

Pauses execution and requests human approval before sensitive tool calls.

```typescript
import { HITLAgent } from '@orka-js/agent';

const agent = new HITLAgent({
  goal: '...',
  tools: [...],
  requireApproval: ['send_email', 'delete_record'],
}, llm);
```

## Examples

See [`examples/streaming-tool-agent.ts`](../../examples/streaming-tool-agent.ts) for a full runnable example.
