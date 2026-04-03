/**
 * Ingest documents into the knowledge base.
 * Run: pnpm ingest
 */
import { createKnowledgeBase, SAMPLE_DOCS } from './knowledge-base.js';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

const kb = createKnowledgeBase(apiKey);

console.log(`Ingesting ${SAMPLE_DOCS.length} documents…`);
await kb.add(SAMPLE_DOCS);
console.log('✓ Documents ingested successfully!');

// Test a search
const results = await kb.similaritySearch('How does memory work?', { topK: 2 });
console.log('\nTest search: "How does memory work?"');
for (const r of results) {
  console.log(`  [${r.score?.toFixed(3)}] ${r.content.slice(0, 80)}…`);
}
