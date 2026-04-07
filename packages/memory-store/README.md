# @orka-js/memory-store

Conversation memory management for OrkaJS agents — sliding window, token buffer, summary, vector, and knowledge graph strategies.

## Installation

```bash
npm install @orka-js/memory-store
```

## Quick Start

```typescript
import { Memory, SessionMemory } from '@orka-js/memory-store';

// Single-conversation buffer with a sliding window
const memory = new Memory({ maxMessages: 20, strategy: 'sliding_window' });

memory.addMessage({ role: 'user', content: 'Hello!' });
memory.addMessage({ role: 'assistant', content: 'Hi there! How can I help?' });

const history = memory.getHistory();
// Pass history to your LLM on every turn
```

```typescript
// Multi-session memory for a web server
const sessions = new SessionMemory({ sessionTTL: 30 * 60 * 1000 }); // 30 min TTL

sessions.addMessage('user-123', { role: 'user', content: 'What is my order status?' });
const history = sessions.getHistory('user-123');

// Clean up expired sessions periodically
const cleared = sessions.clearExpiredSessions();
```

## API

### `Memory`

Basic in-process conversation buffer. Trims automatically according to `strategy`.

```typescript
import { Memory } from '@orka-js/memory-store';

const memory = new Memory({
  maxMessages?: number,          // default 50 — max messages before trimming
  maxTokensEstimate?: number,    // default 4000 — used by 'buffer' strategy
  strategy?: 'sliding_window' | 'buffer' | 'summary',  // default 'sliding_window'
  summaryThreshold?: number,     // default 10 — for 'summary' strategy
});
```

| Method | Returns | Description |
|---|---|---|
| `.addMessage(message)` | `void` | Append a message and trim if needed |
| `.getHistory()` | `Message[]` | Full conversation history |
| `.getLastMessages(count)` | `Message[]` | Last N messages |
| `.getFormattedHistory()` | `string` | `"role: content\n..."` |
| `.getSummary()` | `string` | Summary buffer (only when strategy is `'summary'`) |
| `.getMessageCount()` | `number` | Current message count |
| `.clear()` | `void` | Wipe all messages |

---

### `SessionMemory`

Manages independent `Memory` instances keyed by session ID, with automatic TTL expiry.

```typescript
import { SessionMemory } from '@orka-js/memory-store';

const sessions = new SessionMemory({
  sessionTTL?: number,     // ms before idle session expires (default 30 min)
  maxMessages?: number,
  strategy?: 'sliding_window' | 'buffer' | 'summary',
});
```

| Method | Returns | Description |
|---|---|---|
| `.addMessage(sessionId, message)` | `void` | Add message to a session |
| `.getSession(sessionId)` | `Memory` | Get (or create) the session's `Memory` |
| `.getHistory(sessionId)` | `Message[]` | Message history for a session |
| `.clearSession(sessionId)` | `void` | Delete a session |
| `.clearExpiredSessions()` | `number` | Remove expired sessions, return count |
| `.getActiveSessions()` | `string[]` | List active session IDs |
| `.getSessionCount()` | `number` | Number of active sessions |

---

### `SummaryMemory`

LLM-powered memory that auto-compresses old messages into a rolling summary when the buffer exceeds `maxMessages`. Supports progressive (incremental) compression.

```typescript
import { SummaryMemory } from '@orka-js/memory-store';

const memory = new SummaryMemory({
  llm: myLLMAdapter,         // required — used for summarization
  maxMessages?: number,      // default 20
  summaryThreshold?: number, // default 10
  summaryMaxLength?: number, // default 1000 chars
  preserveSystemMessages?: boolean,    // default true
  progressiveCompression?: boolean,    // default true — incremental summaries
  compressionRatio?: number,           // default 0.5
});
```

| Method | Returns | Description |
|---|---|---|
| `.addMessage(message)` | `Promise<void>` | Add a message; triggers auto-summarization when needed |
| `.addMessages(messages)` | `Promise<void>` | Batch add messages |
| `.getHistory()` | `Message[]` | Messages prefixed with summary system message if available |
| `.getRecentMessages()` | `Message[]` | Raw unsummarized messages |
| `.getSummary()` | `string` | Current summary text |
| `.getSummaryStats()` | `{ summary, messageCount, lastSummarizedAt }` | Summary metadata |
| `.compress()` | `Promise<CompressResult>` | Force compression on demand |
| `.clear()` | `void` | Wipe messages and summary |
| `SummaryMemory.fromJSON(data, llm)` | `SummaryMemory` | Deserialize from JSON |

---

### `VectorMemory`

Stores messages in a vector database for semantic search. Use `.search(query)` to recall the most relevant past exchanges.

```typescript
import { VectorMemory } from '@orka-js/memory-store';

const memory = new VectorMemory({
  embeddings: myEmbeddingsAdapter,  // required
  vectorDB: myVectorDBAdapter,      // required
  maxMessages?: number,             // default 100
  searchTopK?: number,              // default 5
  similarityThreshold?: number,     // default 0.7
  chunkSize?: number,               // context window around matches (default 3)
  includeMetadata?: boolean,        // default true
});
```

| Method | Returns | Description |
|---|---|---|
| `.addMessage(message)` | `Promise<string>` | Embed and store a message; returns ID |
| `.addMessages(messages)` | `Promise<string[]>` | Batch embed and store |
| `.search(query, topK?)` | `Promise<MemorySearchResult[]>` | Find semantically similar messages |
| `.searchWithContext(query, topK?)` | `Promise<MemorySearchResult[]>` | Find matches with surrounding context |
| `.getRelevantHistory(query)` | `Promise<Message[]>` | De-duplicated relevant messages sorted by time |
| `.getHistory()` | `Message[]` | All messages in insertion order |
| `.getRecentMessages(count)` | `Message[]` | Last N messages |
| `.clear()` | `Promise<void>` | Delete all messages from store |

---

### `KGMemory`

Builds a live knowledge graph from conversation content. Entities and relations are extracted in batches by an LLM; the graph is queryable to produce context summaries.

```typescript
import { KGMemory } from '@orka-js/memory-store';

const memory = new KGMemory({
  llm: myLLMAdapter,              // required — used for extraction and querying
  maxMessages?: number,           // default 100
  maxTriples?: number,            // default 500
  extractionBatchSize?: number,   // default 5 — messages per extraction call
  preserveRecentMessages?: number, // default 10
});
```

| Method | Returns | Description |
|---|---|---|
| `.addMessage(message)` | `Promise<void>` | Add message; triggers extraction when batch is full |
| `.addMessages(messages)` | `Promise<void>` | Batch add |
| `.queryKnowledge(query)` | `Promise<string>` | Ask the graph for context relevant to a query |
| `.getContextForQuery(query)` | `Promise<Message[]>` | Graph context + recent messages for prompt injection |
| `.getEntities()` | `Entity[]` | All known entities |
| `.getRelations()` | `Relation[]` | All extracted relations |
| `.getEntity(name)` | `Entity \| undefined` | Look up an entity by name |
| `.getRelationsFor(name)` | `Relation[]` | Relations involving an entity |
| `.getTriples()` | `KnowledgeTriple[]` | All subject–predicate–object triples |
| `.getGraphSummary()` | `{ entityCount, relationCount, tripleCount }` | Graph statistics |
| `.forceExtraction()` | `Promise<void>` | Flush pending extraction |
| `.clear()` | `void` | Wipe messages and graph |
| `KGMemory.fromJSON(data, llm)` | `KGMemory` | Deserialize from JSON |

---

## Types

```typescript
import type {
  Message,
  MemoryConfig,
  SummaryMemoryConfig,
  CompressResult,
  Entity,
  Relation,
  KnowledgeTriple,
  MemorySearchResult,
  MemoryVectorSearchResult,
  BaseLLM,
  BaseEmbeddings,
  BaseVectorDB,
} from '@orka-js/memory-store';
```

**`Message`**

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}
```

## Related Packages

- [`@orka-js/core`](../core) — Core types and adapters
- [`@orka-js/tools`](../tools) — Document loaders and RAG chains
- [`@orka-js/evaluation`](../evaluation) — Evaluate agent quality
- [`orkajs`](../orkajs) — Full OrkaJS bundle
