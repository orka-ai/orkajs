---
"@orka-js/memory-store": minor
---

feat(memory-store): add advanced memory types for long conversations

### SummaryMemory
- Automatic conversation summarization using LLM
- Progressive compression (summarize older messages)
- Configurable summary threshold and max length
- Preserves system messages during summarization
- `forceSummarize()` for manual summarization

### VectorMemory
- Semantic search in conversation history using embeddings
- Integration with any VectorDB adapter
- `search()` and `searchWithContext()` for relevant message retrieval
- `getRelevantHistory()` for query-based context
- Automatic trimming with vector store cleanup

### KGMemory (Knowledge Graph Memory)
- Automatic entity and relation extraction from conversations
- Build knowledge graph from chat history
- `queryKnowledge()` for semantic graph queries
- `getContextForQuery()` for KG-enhanced context
- Entity and relation management APIs

### Usage

```typescript
import { SummaryMemory, VectorMemory, KGMemory } from '@orka-js/memory-store';

// Summary Memory - auto-summarize long conversations
const summaryMemory = new SummaryMemory({
  llm: myLLM,
  maxMessages: 20,
  summaryThreshold: 10,
});

// Vector Memory - semantic search in history
const vectorMemory = new VectorMemory({
  embeddings: myEmbeddings,
  vectorDB: myVectorDB,
  searchTopK: 5,
});

// KG Memory - knowledge graph from conversations
const kgMemory = new KGMemory({
  llm: myLLM,
  extractionBatchSize: 5,
});
```
