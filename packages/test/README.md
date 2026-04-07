# @orka-js/test

Testing utilities for OrkaJS agents — deterministic mock LLM, `AgentTestBed` harness, and custom Vitest/Jest matchers.

## Installation

```bash
npm install --save-dev @orka-js/test
```

Vitest is a peer dependency:

```bash
npm install --save-dev vitest   # if you haven't already
```

## Quick Start

```typescript
import { describe, it, expect } from 'vitest';
import { mockLLM, AgentTestBed, extendExpect } from '@orka-js/test';
import { StreamingToolAgent } from '@orka-js/agent';

extendExpect(expect);  // install custom matchers once, e.g. in a setup file

describe('MyAgent', () => {
  it('answers a direct question', async () => {
    const llm = mockLLM([
      { when: /weather/, output: 'It is sunny in Paris today.' },
    ]);

    const agent = new StreamingToolAgent({ goal: 'Answer questions', tools: [] }, llm);
    const bed = new AgentTestBed({ agent, llm });

    const result = await bed.run('What is the weather in Paris?');

    // Fluent inline assertions (no expect needed)
    result.toHaveOutput(/sunny/);

    // Vitest matchers (after extendExpect)
    expect(result).toHaveOutput(/Paris/);
    expect(result).not.toHaveCalledTool('search');
  });

  it('calls the booking tool', async () => {
    const llm = mockLLM([
      {
        when: /book/,
        toolCall: { name: 'bookDemo', args: { slot: 'tomorrow 10am' } },
      },
    ]);

    const agent = new StreamingToolAgent({ goal: 'Book demos', tools: [bookTool] }, llm);
    const bed = new AgentTestBed({ agent, llm });

    const result = await bed.run('Book a demo for tomorrow morning');

    result.toHaveCalledTool('bookDemo');
    expect(result.toolCalls[0].args.slot).toBe('tomorrow 10am');
  });
});
```

## API

### `mockLLM(responses?, defaultOutput?)`

Factory function that creates a `MockLLMAdapter`.

```typescript
import { mockLLM } from '@orka-js/test';

const llm = mockLLM(
  [
    // Match by substring
    { when: 'hello', output: 'Hi there!' },
    // Match by RegExp
    { when: /weather/, output: 'It is sunny.' },
    // Match by function
    { when: (prompt) => prompt.length > 100, output: 'That is a long prompt.' },
    // Simulate a tool call
    { when: /book/, toolCall: { name: 'book', args: { date: '2026-05-01' } } },
    // Simulate an error
    { when: /fail/, error: new Error('LLM error') },
    // Simulate latency
    { when: /slow/, output: 'Slow response', latencyMs: 500 },
    // Catch-all (no 'when') — matches anything not matched above
    { output: 'Default response' },
  ],
  'Fallback output when no responses match'
);
```

Responses are matched in order; the first matching entry wins.

---

### `MockLLMAdapter`

Full class with assertion helpers. Implements both `LLMAdapter` and `StreamingLLMAdapter`.

```typescript
import { MockLLMAdapter } from '@orka-js/test';

const llm = new MockLLMAdapter(responses, defaultOutput);
```

| Method | Returns | Description |
|---|---|---|
| `.generate(prompt, options?)` | `Promise<LLMResult>` | Standard LLM call |
| `.stream(prompt, options?)` | `AsyncIterable<LLMStreamEvent>` | Streaming call; emits tokens word by word |
| `.embed(text \| text[])` | `Promise<number[][]>` | Returns deterministic mock embeddings (1536-dim) |
| `.getCalls()` | `MockCall[]` | All recorded calls |
| `.getCallCount()` | `number` | Total number of calls made |
| `.wasCalledWith(pattern)` | `boolean` | Whether any call matched the pattern |
| `.getLastCall()` | `MockCall \| undefined` | The most recent call |
| `.reset()` | `void` | Clear recorded calls |

---

### `AgentTestBed`

Test harness that runs an agent and collects output, tool calls, token usage, and raw stream events.

```typescript
import { AgentTestBed } from '@orka-js/test';

const bed = new AgentTestBed({
  agent: myAgent,     // any BaseAgent (StreamingToolAgent, etc.)
  llm?: mockLLM([]), // optional MockLLMAdapter — created automatically if omitted
});
```

**`.run(input): Promise<AgentTestResult & AgentAssertions>`**

Runs the agent and returns a result object with fluent inline assertions.

```typescript
const result = await bed.run('Hello, agent!');

// result fields
result.output       // string — final agent output
result.toolCalls    // Array<{ name, args, callId }>
result.steps        // number — total steps taken
result.usage        // { promptTokens, completionTokens, totalTokens }
result.events       // LLMStreamEvent[] — raw stream events
```

**Fluent inline assertions** (chainable, throw on failure):

```typescript
result
  .toHaveOutput(/expected pattern/)
  .toHaveCalledTool('toolName')
  .not.toHaveCalledTool('otherTool');
```

**`.getLLMMock(): MockLLMAdapter`** — access the internal mock for post-run inspection.

**`.reset(): void`** — reset the LLM mock between tests.

---

### `extendExpect(expect)`

Adds OrkaJS-specific matchers to Vitest or Jest's `expect`. Call once per test suite (e.g. in `vitest.setup.ts`).

```typescript
import { expect } from 'vitest';
import { extendExpect } from '@orka-js/test';

extendExpect(expect);
```

Added matchers on `AgentTestResult`:

| Matcher | Description |
|---|---|
| `expect(result).toHaveOutput(pattern)` | Assert output matches a string or RegExp |
| `expect(result).not.toHaveOutput(pattern)` | Assert output does not match |
| `expect(result).toHaveCalledTool(name)` | Assert a tool was called by name |
| `expect(result).not.toHaveCalledTool(name)` | Assert a tool was not called |

Added matchers on `MockLLMAdapter`:

| Matcher | Description |
|---|---|
| `expect(llm).toHaveBeenCalledWithPrompt(pattern)` | Assert a call containing a pattern was made |
| `expect(llm).toHaveCallCount(n)` | Assert exact number of LLM calls |

---

## Types

```typescript
import type {
  MockResponse,
  MockCall,
  AgentTestResult,
  AgentSnapshot,
} from '@orka-js/test';

import type { AgentAssertions } from '@orka-js/test';
```

**`MockResponse`**

```typescript
interface MockResponse {
  when?: string | RegExp | ((prompt: string) => boolean);
  output?: string;
  toolCall?: { name: string; args: Record<string, unknown>; id?: string };
  error?: Error;
  latencyMs?: number;
}
```

**`AgentTestResult`**

```typescript
interface AgentTestResult {
  output: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; callId: string }>;
  steps: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  events: LLMStreamEvent[];
}
```

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter`
- [`@orka-js/agent`](../agent) — `StreamingToolAgent` and other agent implementations
- [`@orka-js/evaluation`](../evaluation) — Full evaluation framework for RAG and agents
- [`orkajs`](../orkajs) — Full OrkaJS bundle
