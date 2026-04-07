# @orka-js/google

Google Gemini adapter for OrkaJS — Gemini 1.5 Pro/Flash, embeddings, and streaming.

## Installation

```bash
npm install @orka-js/google
```

## Quick Start

```typescript
import { GoogleAdapter } from '@orka-js/google'
import { Orka } from '@orka-js/core'

const llm = new GoogleAdapter({
  apiKey: process.env.GOOGLE_API_KEY!,
  model: 'gemini-1.5-pro',
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
  { role: 'user', content: 'Explain neural networks' }
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
| `apiKey` | `string` | — | Google AI API key (required) |
| `model` | `string` | `'gemini-1.5-flash'` | Model to use |
| `temperature` | `number` | `0.7` | Sampling temperature (0–1) |
| `maxTokens` | `number` | — | Max tokens in response |

## Supported Models

| Model | Description |
|-------|-------------|
| `gemini-1.5-pro` | Most capable, 1M context window |
| `gemini-1.5-flash` | Fast and efficient |

**Embeddings:** `text-embedding-004`

## API

### `GoogleAdapter`

```typescript
const adapter = new GoogleAdapter(config)

adapter.chat(messages: ChatMessage[])   // Promise<ChatResponse>
adapter.stream(messages: ChatMessage[]) // AsyncIterable<StreamEvent>
adapter.embed(text: string)             // Promise<number[]>
```

Implements: `LLMAdapter`, `StreamingLLMAdapter`

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter` interface
- [`@orka-js/openai`](../openai) — OpenAI adapter
- [`orkajs`](../orkajs) — Full bundle
