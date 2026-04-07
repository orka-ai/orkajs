# @orka-js/pgvector

PostgreSQL pgvector adapter for OrkaJS — vector search inside your existing Postgres database.

## Installation

```bash
npm install @orka-js/pgvector
```

Enable the pgvector extension in your PostgreSQL database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Quick Start

```typescript
import { PgVectorAdapter } from '@orka-js/pgvector'
import { Orka } from '@orka-js/core'

const vectorDB = new PgVectorAdapter({
  connectionString: process.env.DATABASE_URL!,
  dimension: 1536,
})

const orka = new Orka({ llm, vectorDB })

await orka.knowledge.ingest([
  { id: 'doc-1', content: 'Hello world' }
])
const results = await orka.knowledge.query('hello', 5)
```

## Direct Usage

```typescript
const adapter = new PgVectorAdapter({
  connectionString: 'postgresql://user:pass@localhost:5432/mydb',
  tableName: 'embeddings',
})

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
| `connectionString` | `string` | PostgreSQL connection string (required) |
| `tableName` | `string` | Default table name |
| `dimension` | `number` | Default vector dimension |

## Requirements

- PostgreSQL 13+
- [pgvector](https://github.com/pgvector/pgvector) extension enabled

## API

### `PgVectorAdapter`

```typescript
adapter.createCollection(name, dimension)           // Promise<void> — creates a table
adapter.deleteCollection(name)                      // Promise<void> — drops the table
adapter.upsert(collection, docs)                    // Promise<void>
adapter.search(collection, vector, topK, filter?)   // Promise<SearchResult[]>
adapter.delete(collection, ids)                     // Promise<void>
```

Implements: `VectorDBAdapter`

## Related Packages

- [`@orka-js/core`](../core) — `VectorDBAdapter` interface
- [`@orka-js/qdrant`](../qdrant) — Dedicated vector DB
- [`@orka-js/memory`](../memory) — In-memory adapter for dev/testing
- [`orkajs`](../orkajs) — Full bundle
