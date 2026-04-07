# @orka-js/replicate

Replicate adapter for OrkaJS — run any open-source model hosted on Replicate (Llama 2, SDXL, etc.).

## Installation

```bash
npm install @orka-js/replicate
```

## Quick Start

```typescript
import { ReplicateAdapter } from '@orka-js/replicate'
import { Orka } from '@orka-js/core'

const llm = new ReplicateAdapter({
  apiToken: process.env.REPLICATE_API_TOKEN!,
  model: 'meta/llama-2-70b-chat',
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
  { role: 'user', content: 'Write a haiku about the ocean' }
])

for await (const chunk of stream) {
  process.stdout.write(chunk.delta ?? '')
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiToken` | `string` | — | Replicate API token (required) |
| `model` | `string` | — | Model identifier (required), e.g. `'meta/llama-2-70b-chat'` |
| `temperature` | `number` | `0.7` | Sampling temperature |
| `maxTokens` | `number` | — | Max tokens in response |

## Supported Models

Any model available on [replicate.com](https://replicate.com/explore) that supports text generation. Common examples:

| Model | Description |
|-------|-------------|
| `meta/llama-2-70b-chat` | Meta Llama 2 70B |
| `mistralai/mistral-7b-instruct-v0.2` | Mistral 7B |
| Any Replicate model slug | Custom hosted models |

## API

### `ReplicateAdapter`

```typescript
const adapter = new ReplicateAdapter(config)

adapter.chat(messages: ChatMessage[])   // Promise<ChatResponse>
adapter.stream(messages: ChatMessage[]) // AsyncIterable<StreamEvent>
```

Implements: `LLMAdapter`, `StreamingLLMAdapter`

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter` interface
- [`@orka-js/ollama`](../ollama) — Local models with Ollama
- [`orkajs`](../orkajs) — Full bundle
