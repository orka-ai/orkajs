# @orka-js/openai

OpenAI adapter for OrkaJS — GPT-4o, GPT-4 Turbo, o1, o3-mini, embeddings, Whisper transcription, and TTS.

## Installation

```bash
npm install @orka-js/openai
```

## Quick Start

```typescript
import { OpenAIAdapter } from '@orka-js/openai'
import { Orka } from '@orka-js/core'

const llm = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
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

## Embeddings

```typescript
const vector = await llm.embed('Hello world')
// Returns: number[]
```

## Audio

```typescript
import { OpenAIAdapter } from '@orka-js/openai'

const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! })

// Speech-to-text (Whisper)
const transcript = await llm.transcribe(audioBuffer, { language: 'en' })
console.log(transcript.text)

// Text-to-speech
const audio = await llm.textToSpeech('Hello world', { voice: 'alloy' })
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | OpenAI API key (required) |
| `model` | `string` | `'gpt-4o'` | Chat model |
| `temperature` | `number` | `0.7` | Sampling temperature (0–2) |
| `maxTokens` | `number` | — | Max tokens in response |
| `baseURL` | `string` | — | Custom API base URL |

## Supported Models

| Model | Description |
|-------|-------------|
| `gpt-4o` | Most capable, multimodal |
| `gpt-4o-mini` | Fast and affordable |
| `gpt-4-turbo` | GPT-4 with 128k context |
| `gpt-3.5-turbo` | Cost-effective |
| `o1` | Advanced reasoning |
| `o1-mini` | Compact reasoning |
| `o3-mini` | Latest reasoning model |

**Embeddings:** `text-embedding-3-small`, `text-embedding-3-large`

## API

### `OpenAIAdapter`

```typescript
const adapter = new OpenAIAdapter(config)

adapter.chat(messages: ChatMessage[])     // Promise<ChatResponse>
adapter.stream(messages: ChatMessage[])   // AsyncIterable<StreamEvent>
adapter.embed(text: string)               // Promise<number[]>
adapter.transcribe(audio, options?)       // Promise<TranscriptionResult>
adapter.textToSpeech(text, options?)      // Promise<Buffer>
```

Implements: `LLMAdapter`, `StreamingLLMAdapter`, `AudioAdapter`

## Related Packages

- [`@orka-js/core`](../core) — Core types and `LLMAdapter` interface
- [`@orka-js/anthropic`](../anthropic) — Anthropic / Claude adapter
- [`orkajs`](../orkajs) — Full bundle
