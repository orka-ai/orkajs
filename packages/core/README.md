# @orka-js/core

Core types, interfaces, and utilities for the OrkaJS ecosystem — the foundation every package builds on.

## Installation

```bash
npm install @orka-js/core
```

## Quick Start

```typescript
import { Orka, createOrka } from '@orka-js/core'
import { OpenAIAdapter } from '@orka-js/openai'

const orka = createOrka({
  llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
})

const response = await orka.chat([
  { role: 'user', content: 'Hello!' }
])
console.log(response.content)
```

## RAG with Knowledge

```typescript
import { Orka, Knowledge } from '@orka-js/core'

const knowledge = new Knowledge({ orka })

await knowledge.ingest([
  { id: 'doc-1', content: 'OrkaJS is a TypeScript AI framework.' }
])

const results = await knowledge.query('What is OrkaJS?', 3)
```

## PII Guard (RGPD)

```typescript
import { PIIGuard, detectPII, redactPII } from '@orka-js/core'

const guard = new PIIGuard()
const detected = guard.detect('My email is john@example.com')
// [{ type: 'email', value: 'john@example.com', start: 12, end: 28 }]

const safe = redactPII('Call me at +1-555-1234')
// 'Call me at [PHONE]'
```

## Streaming

```typescript
import { consumeStream, parseSSEStream } from '@orka-js/core'

const stream = await llm.stream(messages)
const full = await consumeStream(stream)

// SSE from HTTP response
const events = parseSSEStream(response.body!)
for await (const event of events) {
  console.log(event)
}
```

## Callbacks

```typescript
import { CallbackManager } from '@orka-js/core'

const callbacks = new CallbackManager({
  onStart: (run) => console.log('Started', run.id),
  onEnd: (run) => console.log('Done in', run.duration, 'ms'),
  onError: (run, err) => console.error('Error', err),
  onToken: (token) => process.stdout.write(token),
})
```

## Key Exports

| Export | Description |
|--------|-------------|
| `Orka` | Main entry point class |
| `createOrka(config)` | Factory function |
| `Knowledge` | Document ingestion and RAG |
| `LLMAdapter` | Interface for custom LLM adapters |
| `VectorDBAdapter` | Interface for custom vector DB adapters |
| `PIIGuard` | PII detection and redaction |
| `detectPII(text)` | Standalone PII detection |
| `redactPII(text)` | Standalone PII redaction |
| `CallbackManager` | Lifecycle hooks |
| `consumeStream(stream)` | Collect full stream output |
| `parseSSEStream(body)` | Parse SSE streams |
| `chunkDocument(doc, opts)` | Split documents into chunks |
| `generateId()` | Generate unique IDs |
| `OrkaError`, `OrkaErrorCode` | Typed error classes |

## Related Packages

- [`orkajs`](../orkajs) — Full bundle with all adapters
- [`@orka-js/openai`](../openai) — OpenAI adapter
- [`@orka-js/anthropic`](../anthropic) — Anthropic adapter
- [`@orka-js/agent`](../agent) — Agent system
