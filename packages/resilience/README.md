# @orka-js/resilience

Resilience patterns for OrkaJS — retry, fallback, and token budget enforcement for LLM calls.

## Installation

```bash
npm install @orka-js/resilience
```

## Retry

```typescript
import { withRetry } from '@orka-js/resilience'

const result = await withRetry(
  () => llm.chat(messages),
  { maxRetries: 3, delay: 1000, backoff: 'exponential' }
)
```

## Fallback

```typescript
import { FallbackLLM } from '@orka-js/resilience'
import { OpenAIAdapter } from '@orka-js/openai'
import { AnthropicAdapter } from '@orka-js/anthropic'

const llm = new FallbackLLM([
  new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
  new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! }),
])

// Falls back to Anthropic if OpenAI fails
const response = await llm.chat(messages)
```

## Resilient LLM (Retry + Fallback)

```typescript
import { ResilientLLM } from '@orka-js/resilience'

const llm = new ResilientLLM(primaryLLM, {
  retry: { maxRetries: 2, delay: 500 },
  fallbacks: [fallbackLLM],
})
```

## Budget Enforcement

```typescript
import { BudgetedLLM } from '@orka-js/resilience'

const llm = new BudgetedLLM(baseLLM, {
  maxTokens: 100_000,  // hard token limit
  maxCost: 5.00,       // hard cost limit in USD
})

try {
  await llm.chat(messages)
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.log('Budget exceeded:', err.reason)
  }
}
```

## API

### `withRetry(fn, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `delay` | `number` | `1000` | Base delay in ms |
| `backoff` | `'linear' \| 'exponential'` | `'exponential'` | Delay strategy |

### `FallbackLLM`

```typescript
new FallbackLLM(llms: LLMAdapter[])
// Tries each adapter in order, returns first success
```

### `ResilientLLM`

```typescript
new ResilientLLM(primary: LLMAdapter, config: ResilientLLMConfig)
// Combines retry on primary + fallback to alternates
```

### `BudgetedLLM`

```typescript
new BudgetedLLM(llm: LLMAdapter, config: BudgetConfig)
// Throws BudgetExceededError when limits are hit
```

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter` interface
- [`@orka-js/cache`](../cache) — LLM response caching
- [`@orka-js/orchestration`](../orchestration) — Multi-model routing and load balancing
- [`orkajs`](../orkajs) — Full bundle
