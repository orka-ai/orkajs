# @orka-js/chroma

ChromaDB adapter for OrkaJS — open-source embedding database for local development.

## Installation

```bash
npm install @orka-js/chroma
```

Start ChromaDB locally with Docker:

```bash
docker run -p 8000:8000 chromadb/chroma
```

## Quick Start

```typescript
import { ChromaAdapter } from '@orka-js/chroma'
import { Orka } from '@orka-js/core'

const vectorDB = new ChromaAdapter({
  url: 'http://localhost:8000',
})

const orka = new Orka({ llm, vectorDB })

await orka.knowledge.ingest([
  { id: 'doc-1', content: 'Hello world' }
])
const results = await orka.knowledge.query('hello', 5)
```

## Direct Usage

```typescript
const adapter = new ChromaAdapter({ url: 'http://localhost:8000' })

await adapter.createCollection('documents', 1536)
await adapter.upsert('documents', [
  { id: 'doc-1', vector: [...], metadata: { text: 'Hello world' } }
])
const results = await adapter.search('documents', queryVector, 5)
await adapter.delete('documents', ['doc-1'])
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | `'http://localhost:8000'` | ChromaDB server URL |
| `collectionName` | `string` | — | Default collection name |

## API

### `ChromaAdapter`

```typescript
adapter.createCollection(name, dimension)         // Promise<void>
adapter.deleteCollection(name)                    // Promise<void>
adapter.upsert(collection, docs)                  // Promise<void>
adapter.search(collection, vector, topK)          // Promise<SearchResult[]>
adapter.delete(collection, ids)                   // Promise<void>
```

Implements: `VectorDBAdapter`

## Related Packages

- [`@orka-js/core`](../core) — `VectorDBAdapter` interface
- [`@orka-js/memory`](../memory) — In-memory adapter (no server required)
- [`@orka-js/pgvector`](../pgvector) — PostgreSQL adapter
- [`orkajs`](../orkajs) — Full bundle
