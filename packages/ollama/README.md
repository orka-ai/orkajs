# @orka-js/ollama

Ollama adapter for OrkaJS — run local models (Llama 3, Mistral, etc.) with zero API costs and full privacy.

## Installation

```bash
npm install @orka-js/ollama
```

Requires [Ollama](https://ollama.com) running locally:

```bash
# Install and start Ollama
ollama serve
ollama pull llama3.2
```

## Quick Start

```typescript
import { OllamaAdapter } from '@orka-js/ollama'
import { Orka } from '@orka-js/core'

const llm = new OllamaAdapter({
  model: 'llama3.2',
  // baseUrl defaults to http://localhost:11434
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
  { role: 'user', content: 'Write a poem about the sea' }
])

for await (const chunk of stream) {
  process.stdout.write(chunk.delta ?? '')
}
```

## Embeddings

```typescript
// Requires a model with embedding support (e.g. nomic-embed-text)
const vector = await llm.embed('Hello world')
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | `'llama3.2'` | Local model name |
| `baseUrl` | `string` | `'http://localhost:11434'` | Ollama server URL |
| `temperature` | `number` | `0.7` | Sampling temperature |
| `maxTokens` | `number` | — | Max tokens in response |

## Popular Models

```bash
ollama pull llama3.2        # Meta Llama 3.2
ollama pull mistral         # Mistral 7B
ollama pull codellama       # Code-specialized Llama
ollama pull nomic-embed-text # Embeddings model
```

## API

### `OllamaAdapter`

```typescript
const adapter = new OllamaAdapter(config)

adapter.chat(messages: ChatMessage[])   // Promise<ChatResponse>
adapter.stream(messages: ChatMessage[]) // AsyncIterable<StreamEvent>
adapter.embed(text: string)             // Promise<number[]>
```

Implements: `LLMAdapter`, `StreamingLLMAdapter`

> **Cost:** $0 — all computation runs locally.

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter` interface
- [`@orka-js/openai`](../openai) — OpenAI adapter
- [`orkajs`](../orkajs) — Full bundle
