# @orka-js/qdrant

Qdrant vector database adapter for OrkaJS — high-performance open-source vector search.

## Installation

```bash
npm install @orka-js/qdrant
```

Start Qdrant locally with Docker:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

## Quick Start

```typescript
import { QdrantAdapter } from '@orka-js/qdrant'
import { Orka } from '@orka-js/core'

const vectorDB = new QdrantAdapter({
  url: 'http://localhost:6333',
})

const orka = new Orka({ llm, vectorDB })

await orka.knowledge.ingest([
  { id: 'doc-1', content: 'Hello world' }
])
const results = await orka.knowledge.query('hello', 5)
```

## Direct Usage

```typescript
const adapter = new QdrantAdapter({ url: 'http://localhost:6333' })

await adapter.createCollection('documents', 1536, 'cosine')
await adapter.upsert('documents', [
  { id: 'doc-1', vector: [...], metadata: { text: 'Hello world' } }
])
const results = await adapter.search('documents', queryVector, 5)
await adapter.delete('documents', ['doc-1'])
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | — | Qdrant server URL (required) |
| `apiKey` | `string` | — | API key for Qdrant Cloud |
| `collectionName` | `string` | — | Default collection name |

## Distance Metrics

| Value | Description |
|-------|-------------|
| `cosine` | Cosine similarity (recommended for normalized embeddings) |
| `euclidean` | L2 distance |
| `dotProduct` | Dot product (for un-normalized embeddings) |

## API

### `QdrantAdapter`

```typescript
adapter.createCollection(name, dimension, distance?)  // Promise<void>
adapter.deleteCollection(name)                        // Promise<void>
adapter.upsert(collection, docs)                      // Promise<void>
adapter.search(collection, vector, topK, filter?)     // Promise<SearchResult[]>
adapter.delete(collection, ids)                       // Promise<void>
```

Implements: `VectorDBAdapter`

## Related Packages

- [`@orka-js/core`](../core) — `VectorDBAdapter` interface
- [`@orka-js/pinecone`](../pinecone) — Managed cloud alternative
- [`@orka-js/memory`](../memory) — In-memory adapter for dev/testing
- [`orkajs`](../orkajs) — Full bundle
