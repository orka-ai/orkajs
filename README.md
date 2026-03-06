<p align="center">
  <img src="https://orkajs.com/loutre-orka.png" alt="OrkaJS" width="120" />
</p>

<h1 align="center">OrkaJS</h1>

<p align="center">
  <strong>TypeScript framework for building production-ready LLM systems. RAG, agents, workflows, multi-model orchestration.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/orkajs"><img src="https://img.shields.io/npm/v/orkajs.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/orkajs"><img src="https://img.shields.io/npm/dm/orkajs.svg" alt="npm downloads"></a>
  <a href="https://github.com/orkajs/orkajs/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/orkajs.svg" alt="license"></a>
  <a href="https://orkajs.com"><img src="https://img.shields.io/badge/docs-orkajs.com-blue.svg" alt="documentation"></a>
</p>

---

## Installation

```bash
npm install orkajs
```

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

## Providers

**LLM:** OpenAI, Anthropic, Mistral, Ollama  
**Vector DB:** Pinecone, Qdrant, Chroma, In-Memory

## Documentation

**📚 [orkajs.com](https://orkajs.com)**
**💬 [Discord](https://discord.gg/KAZCesekvg)**

- [Getting Started](https://orkajs.com/en/getting-started/introduction)
- [RAG & Knowledge](https://orkajs.com/en/core/knowledge)
- [Agents](https://orkajs.com/en/agents/overview)
- [Workflows](https://orkajs.com/en/workflows/multi-step)
- [Best Practices](https://orkajs.com/en/best-practices)

## License

MIT © [Orka Team](https://github.com/orkajs)
