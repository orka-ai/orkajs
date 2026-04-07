# @orka-js/cohere

Cohere adapter for OrkaJS — Command R+, embeddings, and streaming.

## Installation

```bash
npm install @orka-js/cohere
```

## Quick Start

```typescript
import { CohereAdapter } from '@orka-js/cohere'
import { Orka } from '@orka-js/core'

const llm = new CohereAdapter({
  apiKey: process.env.COHERE_API_KEY!,
  model: 'command-r-plus',
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
  { role: 'user', content: 'Summarize this document...' }
])

for await (const chunk of stream) {
  process.stdout.write(chunk.delta ?? '')
}
```

## Embeddings

```typescript
const vector = await llm.embed('Hello world')
// Returns: number[]
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | Cohere API key (required) |
| `model` | `string` | `'command-r-plus'` | Model to use |
| `temperature` | `number` | `0.7` | Sampling temperature (0–1) |

## Supported Models

| Model | Description |
|-------|-------------|
| `command-r-plus` | Most capable, optimized for RAG |
| `command-r` | Balanced performance |
| `command` | Fast and cost-effective |

## API

### `CohereAdapter`

```typescript
const adapter = new CohereAdapter(config)

adapter.chat(messages: ChatMessage[])   // Promise<ChatResponse>
adapter.stream(messages: ChatMessage[]) // AsyncIterable<StreamEvent>
adapter.embed(text: string)             // Promise<number[]>
```

Implements: `LLMAdapter`, `StreamingLLMAdapter`

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter` interface
- [`@orka-js/openai`](../openai) — OpenAI adapter
- [`orkajs`](../orkajs) — Full bundle
