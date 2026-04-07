# @orka-js/memory

In-memory vector database adapter for OrkaJS — ideal for development, testing, and small datasets.

## Installation

```bash
npm install @orka-js/memory
```

## Quick Start

```typescript
import { MemoryVectorAdapter } from '@orka-js/memory'
import { Orka } from '@orka-js/core'

const vectorDB = new MemoryVectorAdapter()

const orka = new Orka({ llm, vectorDB })

await orka.knowledge.ingest([
  { id: 'doc-1', content: 'Hello world' },
  { id: 'doc-2', content: 'Goodbye world' },
])

const results = await orka.knowledge.query('hello', 2)
```

## Direct Usage

```typescript
const adapter = new MemoryVectorAdapter({ similarity: 'cosine' })

await adapter.createCollection('docs', 3)
await adapter.upsert('docs', [
  { id: '1', vector: [0.1, 0.2, 0.3], metadata: { text: 'foo' } },
  { id: '2', vector: [0.4, 0.5, 0.6], metadata: { text: 'bar' } },
])

const results = await adapter.search('docs', [0.1, 0.2, 0.3], 1)
const stats = await adapter.getCollectionStats('docs')
// { count: 2, dimension: 3 }
```

> **Note:** Data is stored in process memory only and is not persisted across restarts.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `similarity` | `'cosine' \| 'euclidean' \| 'dotProduct'` | `'cosine'` | Similarity metric for vector search |

## API

### `MemoryVectorAdapter`

Also exported as `MemoryVectorDBAdapter` (alias).

```typescript
adapter.createCollection(name, dimension)     // Promise<void>
adapter.upsert(collection, docs)              // Promise<void>
adapter.search(collection, vector, topK)      // Promise<SearchResult[]>
adapter.delete(collection, ids)               // Promise<void>
adapter.getCollectionStats(name)              // Promise<{ count, dimension }>
```

Implements: `VectorDBAdapter`

## Related Packages

- [`@orka-js/core`](../core) — `VectorDBAdapter` interface
- [`@orka-js/qdrant`](../qdrant) — Qdrant for production use
- [`@orka-js/pgvector`](../pgvector) — PostgreSQL adapter
- [`orkajs`](../orkajs) — Full bundle
