# @orka-js/mistral

Mistral AI adapter for OrkaJS — Mistral Large, Codestral, embeddings, and streaming.

## Installation

```bash
npm install @orka-js/mistral
```

## Quick Start

```typescript
import { MistralAdapter } from '@orka-js/mistral'
import { Orka } from '@orka-js/core'

const llm = new MistralAdapter({
  apiKey: process.env.MISTRAL_API_KEY!,
  model: 'mistral-large-latest',
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
  { role: 'user', content: 'Explain quantum computing' }
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
| `apiKey` | `string` | — | Mistral API key (required) |
| `model` | `string` | `'mistral-large-latest'` | Model to use |
| `temperature` | `number` | `0.7` | Sampling temperature |
| `maxTokens` | `number` | — | Max tokens in response |

## Supported Models

| Model | Description |
|-------|-------------|
| `mistral-large-latest` | Most powerful Mistral model |
| `mistral-medium` | Balanced performance |
| `mistral-small` | Fast and cost-effective |
| `open-mistral-7b` | Open-source 7B model |
| `open-mixtral-8x7b` | Mixture-of-experts model |
| `codestral` | Code-specialized model |

**Embeddings:** `mistral-embed`

## API

### `MistralAdapter`

```typescript
const adapter = new MistralAdapter(config)

adapter.chat(messages: ChatMessage[])   // Promise<ChatResponse>
adapter.stream(messages: ChatMessage[]) // AsyncIterable<StreamEvent>
adapter.embed(text: string)             // Promise<number[]>
```

Implements: `LLMAdapter`, `StreamingLLMAdapter`

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter` interface
- [`@orka-js/openai`](../openai) — OpenAI adapter
- [`orkajs`](../orkajs) — Full bundle
