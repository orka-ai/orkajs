import { OpenAIAdapter } from '@orka-js/openai';
import { InMemoryVectorStore } from '@orka-js/memory';

export function createKnowledgeBase(apiKey: string) {
  const llm = new OpenAIAdapter({ apiKey });
  const vectorStore = new InMemoryVectorStore({ llm });
  return vectorStore;
}

export const SAMPLE_DOCS = [
  {
    id: 'orka-intro',
    content: 'OrkaJS is a TypeScript AI agent framework with 35+ packages. It supports streaming, tool calls, memory, graph workflows, RAG, and multi-modal interactions.',
    metadata: { source: 'docs', topic: 'introduction' },
  },
  {
    id: 'orka-agents',
    content: 'OrkaJS includes several agent types: ReActAgent (think/act loop), StreamingToolAgent (streaming + tools), PlanAndExecuteAgent (plan first, then execute), and HITLAgent (human-in-the-loop).',
    metadata: { source: 'docs', topic: 'agents' },
  },
  {
    id: 'orka-adapters',
    content: 'OrkaJS supports OpenAI (GPT-4o), Anthropic (Claude), Google (Gemini), Mistral, Cohere, Ollama (local), and Replicate as LLM providers.',
    metadata: { source: 'docs', topic: 'adapters' },
  },
  {
    id: 'orka-memory',
    content: 'OrkaJS memory system includes sliding window memory, summarization memory, vector-based semantic memory, and knowledge graph memory.',
    metadata: { source: 'docs', topic: 'memory' },
  },
  {
    id: 'orka-graph',
    content: 'OrkaJS GraphWorkflow enables building complex multi-step pipelines with conditional branching, parallel execution, and Mermaid diagram export.',
    metadata: { source: 'docs', topic: 'graph' },
  },
];
