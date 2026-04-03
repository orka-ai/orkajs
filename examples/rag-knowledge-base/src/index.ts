/**
 * RAG Knowledge Base example.
 *
 * Demonstrates: StreamingToolAgent + vector search tool + InMemoryVectorStore
 *
 * Usage:
 *   OPENAI_API_KEY=... pnpm start "How does OrkaJS handle memory?"
 */
import { StreamingToolAgent } from '@orka-js/agent';
import { OpenAIAdapter } from '@orka-js/openai';
import { createKnowledgeBase, SAMPLE_DOCS } from './knowledge-base.js';
import type { Tool } from '@orka-js/agent';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('OPENAI_API_KEY is required'); process.exit(1); }

// Initialize and populate knowledge base
const kb = createKnowledgeBase(apiKey);
await kb.add(SAMPLE_DOCS);

// Define the search tool
const searchDocsTool: Tool = {
  name: 'search_docs',
  description: 'Search the knowledge base for information about OrkaJS',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query', required: true },
    { name: 'topK', type: 'number', description: 'Number of results to return (default: 3)', required: false },
  ],
  execute: async ({ query, topK }: { query: string; topK?: number }) => {
    const results = await kb.similaritySearch(query, { topK: topK ?? 3 });
    if (results.length === 0) return 'No relevant documents found.';
    return results
      .map((r, i) => `[${i + 1}] (score: ${r.score?.toFixed(3) ?? '?'})\n${r.content}`)
      .join('\n\n');
  },
};

const llm = new OpenAIAdapter({ apiKey, model: 'gpt-4o-mini' });
const agent = new StreamingToolAgent({
  goal: 'Answer questions about OrkaJS using the knowledge base. Always search before answering.',
  tools: [searchDocsTool],
}, llm);

const question = process.argv[2] ?? 'What LLM providers does OrkaJS support?';
console.log(`Question: ${question}\n`);
console.log('Answer: ');

for await (const event of agent.runStream(question)) {
  if (event.type === 'token') {
    process.stdout.write(event.token);
  } else if (event.type === 'tool_call') {
    process.stderr.write(`\n[Tool: ${event.name}(${event.arguments})]\n`);
  } else if (event.type === 'done') {
    console.log('\n');
  }
}
