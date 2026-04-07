# @orka-js/orchestration

Multi-model orchestration for OrkaJS — routing, consensus, racing, and load balancing across LLMs.

## Installation

```bash
npm install @orka-js/orchestration @orka-js/core
```

## Router — Route to the Right Model

```typescript
import { RouterLLM } from '@orka-js/orchestration'

const router = new RouterLLM({
  routes: [
    {
      condition: (messages) => messages.some(m => m.content.includes('code')),
      llm: new OpenAIAdapter({ model: 'gpt-4o' }),
    },
    {
      condition: (messages) => messages[0].content.length > 2000,
      llm: new AnthropicAdapter({ model: 'claude-sonnet-4-6' }),
    },
  ],
  defaultLLM: new OpenAIAdapter({ model: 'gpt-4o-mini' }),
})

const response = await router.chat(messages)
```

## Consensus — Aggregate Multiple Models

```typescript
import { ConsensusLLM } from '@orka-js/orchestration'

const consensus = new ConsensusLLM({
  llms: [openai, anthropic, mistral],
  strategy: 'majority', // or 'best'
})

// Queries all 3 models, returns majority answer
const response = await consensus.chat(messages)
```

## Race — Use the Fastest Response

```typescript
import { RaceLLM } from '@orka-js/orchestration'

const race = new RaceLLM({
  llms: [openai, anthropic, ollama],
})

// Returns the first response that arrives
const response = await race.chat(messages)
```

## Load Balancer — Distribute Requests

```typescript
import { LoadBalancerLLM } from '@orka-js/orchestration'

const lb = new LoadBalancerLLM({
  llms: [openai1, openai2, openai3],
  strategy: 'round-robin', // or 'random'
})

// Distributes calls evenly across instances
const response = await lb.chat(messages)
```

## API

All classes implement `LLMAdapter` and can be used anywhere an LLM is expected:

```typescript
router.chat(messages)    // Promise<ChatResponse>
router.stream(messages)  // AsyncIterable<StreamEvent>
```

## Related Packages

- [`@orka-js/resilience`](../resilience) — Retry and fallback patterns
- [`@orka-js/cache`](../cache) — LLM response caching
- [`@orka-js/core`](../core) — `LLMAdapter` interface
- [`orkajs`](../orkajs) — Full bundle
