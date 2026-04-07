# @orka-js/tools

Document loaders, text splitters, retrievers, output parsers, RAG chains, and prompt templates for OrkaJS.

## Installation

```bash
npm install @orka-js/tools
```

PDF loading requires an optional peer dependency:

```bash
npm install pdf-parse   # only if you use PDFLoader
```

Schema validation in `StructuredOutputParser` requires:

```bash
npm install zod         # only if you use StructuredOutputParser
```

## Quick Start

```typescript
import { TextLoader, RecursiveCharacterTextSplitter, VectorRetriever, RetrievalQAChain } from '@orka-js/tools';

// 1. Load a document
const loader = new TextLoader('./docs/faq.txt');
const docs = await loader.load();

// 2. Split into chunks
const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
const chunks = splitter.splitDocuments(docs);

// 3. Set up a vector retriever (llm and vectorDB come from @orka-js/core adapters)
const retriever = new VectorRetriever({ llm, vectorDB, topK: 5 });

// 4. Build a RAG chain and ask a question
const chain = new RetrievalQAChain({ llm, retriever, collection: 'faq' });
const result = await chain.call('What is the refund policy?');

console.log(result.answer);
console.log(result.sources); // retrieved passages
```

## API

### Loaders

All loaders implement `async load(): Promise<Document[]>`.

| Class | Constructor | Description |
|---|---|---|
| `TextLoader` | `(path, options?)` | Load a plain text file |
| `CSVLoader` | `(path, options?)` | Load CSV rows as documents |
| `JSONLoader` | `(path, options?)` | Load JSON file |
| `MarkdownLoader` | `(path, options?)` | Load Markdown file |
| `PDFLoader` | `(path, options?)` | Load PDF (requires `pdf-parse`) |
| `DirectoryLoader` | `(dir, options?)` | Load all files in a directory |
| `NotionLoader` | `(options)` | Load pages from Notion |
| `SlackLoader` | `(options)` | Load messages from Slack |
| `GitHubLoader` | `(options)` | Load files from a GitHub repository |
| `GoogleDriveLoader` | `(options)` | Load files from Google Drive |

```typescript
import { DirectoryLoader } from '@orka-js/tools';

const loader = new DirectoryLoader('./docs', { recursive: true });
const docs = await loader.load();
```

### Text Splitters

All splitters expose `.split(text): string[]` and `.splitDocuments(docs): Chunk[]`.

| Class | Key Options |
|---|---|
| `RecursiveCharacterTextSplitter` | `chunkSize`, `chunkOverlap`, `separators`, `keepSeparator` |
| `MarkdownTextSplitter` | Splits on Markdown headings and blocks |
| `CodeTextSplitter` | Splits on code-aware boundaries (functions, classes) |
| `TokenTextSplitter` | Splits by estimated token count |

```typescript
import { RecursiveCharacterTextSplitter } from '@orka-js/tools';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,   // default
  chunkOverlap: 200, // default
});

const chunks = splitter.splitDocuments(docs);
// chunks[0] → { id, content, documentId, index, metadata }
```

### Retrievers

All retrievers expose `async retrieve(query, collection): Promise<VectorSearchResult[]>`.

| Class | Description |
|---|---|
| `VectorRetriever` | Embedding-based similarity search |
| `BM25Retriever` | Keyword-based BM25 retrieval |
| `MultiQueryRetriever` | Generates multiple query variants with an LLM |
| `EnsembleRetriever` | Combines results from multiple retrievers |
| `ContextualCompressionRetriever` | Compresses retrieved passages using an LLM |
| `ParentDocumentRetriever` | Returns parent chunks for context expansion |
| `SelfQueryRetriever` | Converts natural-language filters to structured queries |

```typescript
import { EnsembleRetriever, VectorRetriever, BM25Retriever } from '@orka-js/tools';

const retriever = new EnsembleRetriever({
  retrievers: [
    new VectorRetriever({ llm, vectorDB }),
    new BM25Retriever({ documents }),
  ],
  weights: [0.7, 0.3],
});
```

### Output Parsers

All parsers expose `.parse(text): T`.

| Class | Description |
|---|---|
| `JSONParser` | Parse raw JSON from LLM output |
| `StructuredOutputParser` | Validate parsed JSON against a Zod schema |
| `ListParser` | Parse newline-separated or numbered lists |
| `CommaSeparatedListParser` | Parse comma-separated values |
| `CSVParser` | Parse CSV-formatted output |
| `XMLParser` | Parse XML tags from LLM output |
| `AutoFixParser` | Retry parsing with an LLM-powered auto-fix on failure |

```typescript
import { StructuredOutputParser } from '@orka-js/tools';
import { z } from 'zod';

const parser = StructuredOutputParser.fromZodSchema(
  z.object({ name: z.string(), score: z.number() })
);

const result = parser.parse('{"name": "Alice", "score": 0.92}');
// result.name === 'Alice'

console.log(parser.getFormatInstructions()); // inject into your prompt
```

### RAG Chains

| Class | Method | Description |
|---|---|---|
| `RetrievalQAChain` | `.call(question)` | Retrieve context, then answer a question |
| `ConversationalRetrievalChain` | `.call(question, history?)` | Conversational QA with memory |
| `SummarizationChain` | `.call(documents)` | Summarize a list of documents |
| `QAChain` | `.call(question, context)` | Answer using provided context directly |

```typescript
import { RetrievalQAChain } from '@orka-js/tools';

const chain = new RetrievalQAChain({
  llm,
  retriever,
  collection: 'my-docs',
  returnSources: true,       // default: true
  maxSourceTokens: 3000,     // default
  systemPrompt: 'You are a helpful assistant...',
});

const { answer, sources, intermediateSteps, usage } = await chain.call('What is X?');
```

### Prompt Templates

| Class | Method | Description |
|---|---|---|
| `PromptTemplate` | `.format(variables)` | Simple `{variable}` substitution |
| `ChatPromptTemplate` | `.formatMessages(variables)` | Multi-turn chat prompt |
| `FewShotPromptTemplate` | `.format(variables)` | Prompt with few-shot examples |

```typescript
import { PromptTemplate } from '@orka-js/tools';

const template = new PromptTemplate({
  template: 'Summarize the following text in {language}:\n\n{text}',
  inputVariables: ['language', 'text'],
});

const prompt = template.format({ language: 'French', text: '...' });
```

## Types

```typescript
import type {
  DocumentLoader,
  LoaderOptions,
  CSVLoaderOptions,
  JSONLoaderOptions,
  MarkdownLoaderOptions,
  PDFLoaderOptions,
  TextLoaderOptions,
  DirectoryLoaderOptions,
  NotionLoaderOptions,
  SlackLoaderOptions,
  GitHubLoaderOptions,
  GoogleDriveLoaderOptions,
} from '@orka-js/tools';
```

## Related Packages

- [`@orka-js/core`](../core) — Core types (`Document`, `Chunk`, `LLMAdapter`, `VectorDBAdapter`)
- [`@orka-js/memory-store`](../memory-store) — Conversation memory for RAG agents
- [`@orka-js/evaluation`](../evaluation) — Evaluate RAG chain quality
- [`orkajs`](../orkajs) — Full OrkaJS bundle
