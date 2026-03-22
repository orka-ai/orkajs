<p align="center">
  <img src="https://orkajs.com/loutre-orka.png" alt="OrkaJS" width="180" />
</p>

<h1 align="center">OrkaJS</h1>

<p align="center">
  <strong>Ship AI features 10x faster. Production-ready RAG, agents, and workflows with type-safe TypeScript. Zero boilerplate, infinite possibilities.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/orkajs"><img src="https://img.shields.io/npm/v/orkajs.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/orkajs"><img src="https://img.shields.io/npm/dm/orkajs.svg" alt="npm downloads"></a>
  <a href="https://github.com/orkajs/orkajs/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/orkajs.svg" alt="license"></a>
  <a href="https://orkajs.com"><img src="https://img.shields.io/badge/docs-orkajs.com-blue.svg" alt="documentation"></a>
  <a href="https://discord.com/invite/DScfpuPysP"><img src="https://img.shields.io/badge/discord-join%20chat-7289da.svg" alt="discord"></a>
</p>

---

## Installation

**Full package (recommended):**
```bash
npm install orkajs
```

**Or install only what you need:**
```bash
npm install @orka-js/core @orka-js/tools @orka-js/memory
```

<details>
<summary><strong>📦 Available packages</strong></summary>

| Package | Description |
|---------|-------------|
| `orkajs` | Full package with all features |
| `@orka-js/core` | Types, errors, utils, Knowledge |
| `@orka-js/openai` | OpenAI adapter |
| `@orka-js/anthropic` | Anthropic adapter |
| `@orka-js/mistral` | Mistral adapter |
| `@orka-js/ollama` | Ollama adapter |
| `@orka-js/memory` | In-memory vector store |
| `@orka-js/pinecone` | Pinecone adapter |
| `@orka-js/qdrant` | Qdrant adapter |
| `@orka-js/chroma` | ChromaDB adapter |
| `@orka-js/agent` | Agents (ReAct, HITL, Toolkits) |
| `@orka-js/tools` | Loaders, splitters, parsers, chains |
| `@orka-js/cache` | Memory/Redis cache |
| `@orka-js/resilience` | Retry, fallback |
| `@orka-js/orchestration` | Router, Consensus, Race, LoadBalancer |
| `@orka-js/workflow` | Multi-step workflows |
| `@orka-js/graph` | Graph workflows |
| `@orka-js/evaluation` | Metrics, test runner |
| `@orka-js/observability` | Tracer, hooks |
| `@orka-js/prompts` | Prompt versioning |
| `@orka-js/memory-store` | Conversation memory |
| `@orka-js/ocr` | OCR & document extraction |

</details>

## Quick Start

```typescript
import { createOrka, AnthropicAdapter, MemoryVectorAdapter } from 'orkajs';

const orka = createOrka({
  llm: new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! }),
  vectorDB: new MemoryVectorAdapter(),
});

// Create knowledge base
await orka.knowledge.create({
  name: 'docs',
  source: ['OrkaJS is a TypeScript framework for LLM systems.'],
});

// Ask with RAG
const result = await orka.ask({
  knowledge: 'docs',
  question: 'What is OrkaJS?',
});

console.log(result.answer);
```

## Features

| Feature | Description |
|---------|-------------|
| **RAG** | Semantic search & retrieval-augmented generation |
| **Agents** | Structured agents with tools, policies, ReAct, Plan&Execute |
| **Workflows** | Multi-step pipelines with plan, retrieve, generate, verify |
| **Adapters** | Pluggable adapters for LLMs and vector databases |
| **Graph Workflows** | Conditional branching with Mermaid export |
| **Multi-Model** | Router, Consensus, Race, LoadBalancer orchestration |
| **Memory** | Conversation memory with sliding window, buffer, summary |
| **Evaluation** | Built-in metrics: relevance, faithfulness, hallucination |
| **Resilience** | Retry, fallback, timeouts, circuit breaker patterns |
| **Caching** | Memory & Redis cache for LLM and embeddings |
| **OCR** | Extract text from images, PDFs, scanned documents (Tesseract, OpenAI Vision) |
| **PII Guard** | Detect and redact sensitive data before LLM calls (RGPD compliant) |

## Providers

**LLM:** OpenAI, Anthropic, Mistral, Ollama  
**Vector DB:** Pinecone, Qdrant, Chroma, In-Memory

## Documentation

**📚 [orkajs.com](https://orkajs.com)**
**💬 [Discord](https://discord.com/invite/DScfpuPysP)**

- [Getting Started](https://orkajs.com/en/getting-started/introduction)
- [RAG & Knowledge](https://orkajs.com/en/core/knowledge)
- [Agents](https://orkajs.com/en/agents/overview)
- [Workflows](https://orkajs.com/en/workflows/multi-step)
- [Best Practices](https://orkajs.com/en/best-practices)

## License

MIT © [Orka Team](https://github.com/orkajs)
