# @orka-js/pinecone

Pinecone vector database adapter for OrkaJS — managed cloud vector search.

## Installation

```bash
npm install @orka-js/pinecone
```

## Quick Start

```typescript
import { PineconeAdapter } from '@orka-js/pinecone'
import { OpenAIAdapter } from '@orka-js/openai'
import { Orka } from '@orka-js/core'

const vectorDB = new PineconeAdapter({
  apiKey: process.env.PINECONE_API_KEY!,
  environment: 'us-east1-gcp',
  indexName: 'my-index',
})

const orka = new Orka({ llm, vectorDB })

// Ingest documents
await orka.knowledge.ingest([
  { id: 'doc-1', content: 'Hello world', metadata: { source: 'manual' } }
])

// Semantic search
const results = await orka.knowledge.query('hello', 5)
```

## Direct Usage

```typescript
const adapter = new PineconeAdapter({ apiKey, environment, indexName })

await adapter.createCollection('documents', 1536)
await adapter.upsert('documents', [
  { id: 'doc-1', vector: [...], metadata: { text: 'Hello world' } }
])
const results = await adapter.search('documents', queryVector, 5)
await adapter.delete('documents', ['doc-1'])
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `apiKey` | `string` | Pinecone API key (required) |
| `environment` | `string` | Pinecone environment, e.g. `us-east1-gcp` (required) |
| `indexName` | `string` | Index name to use (required) |

## API

### `PineconeAdapter`

```typescript
adapter.createCollection(name, dimension)           // Promise<void>
adapter.deleteCollection(name)                      // Promise<void>
adapter.upsert(collection, docs)                    // Promise<void>
adapter.search(collection, vector, topK, filter?)   // Promise<SearchResult[]>
adapter.delete(collection, ids)                     // Promise<void>
```

Implements: `VectorDBAdapter`

## Related Packages

- [`@orka-js/core`](../core) — `VectorDBAdapter` interface
- [`@orka-js/qdrant`](../qdrant) — Self-hosted alternative
- [`@orka-js/memory`](../memory) — In-memory adapter for dev/testing
- [`orkajs`](../orkajs) — Full bundle
