# @orka-js/anthropic

Anthropic adapter for OrkaJS — Claude 4, Claude 3.5, streaming, and cost tracking.

## Installation

```bash
npm install @orka-js/anthropic
```

## Quick Start

```typescript
import { AnthropicAdapter } from '@orka-js/anthropic'
import { Orka } from '@orka-js/core'

const llm = new AnthropicAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-6',
})

const orka = new Orka({ llm })

const response = await orka.chat([
  { role: 'user', content: 'Hello!' }
])
console.log(response.content)
```

## Streaming

```typescript
const stream = await llm.stream([
  { role: 'user', content: 'Tell me a story' }
])

for await (const chunk of stream) {
  process.stdout.write(chunk.delta ?? '')
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | Anthropic API key (required) |
| `model` | `string` | `'claude-sonnet-4-6'` | Model to use |
| `temperature` | `number` | `0.7` | Sampling temperature (0–1) |
| `maxTokens` | `number` | `4096` | Max tokens in response |

## Supported Models

| Model | Description |
|-------|-------------|
| `claude-opus-4-6` | Most powerful, best for complex tasks |
| `claude-sonnet-4-6` | Balanced performance and speed |
| `claude-haiku-4-5` | Fastest and most compact |
| `claude-3-5-sonnet-20241022` | Claude 3.5 Sonnet |
| `claude-3-opus-20240229` | Claude 3 Opus |
| `claude-3-haiku-20240307` | Claude 3 Haiku |

## API

### `AnthropicAdapter`

```typescript
const adapter = new AnthropicAdapter(config)

adapter.chat(messages: ChatMessage[])   // Promise<ChatResponse>
adapter.stream(messages: ChatMessage[]) // AsyncIterable<StreamEvent>
```

Implements: `LLMAdapter`, `StreamingLLMAdapter`

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter` interface
- [`@orka-js/openai`](../openai) — OpenAI adapter
- [`orkajs`](../orkajs) — Full bundle
