import { createOrka, OpenAIAdapter, MemoryVectorAdapter } from '../src/index.js';

async function main() {
  const orka = createOrka({
    llm: new OpenAIAdapter({ 
      apiKey: process.env.OPENAI_API_KEY! 
    }),
    vectorDB: new MemoryVectorAdapter(),
    defaults: {
      chunkSize: 500,
      chunkOverlap: 100,
      topK: 3,
    },
  });

  console.log('📚 Creation of the knowledge base...');
  
  const result = await orka.knowledge.create({
    name: 'faq',
    source: [
      {
        text: 'Orka JS is a TypeScript framework for building production-ready LLM systems. It simplifies RAG, embeddings, and vector database management.',
        metadata: { category: 'general' },
      },
      {
        text: 'To install Orka JS, use npm install orkajs. The library supports OpenAI, Anthropic, Mistral, and Ollama as LLM providers.',
        metadata: { category: 'installation' },
      },
      {
        text: 'Orka JS supports multiple vector databases: Pinecone, Qdrant, Chroma, and an in-memory adapter for development.',
        metadata: { category: 'features' },
      },
      {
        text: 'Chunking is automatic in Orka JS. By default, documents are split into chunks of 1000 characters with an overlap of 200.',
        metadata: { category: 'features' },
      },
    ],
  });

  console.log(`✅ Base created: ${result.documentCount} documents, ${result.chunkCount} chunks`);

  console.log('\n🔍 Semantic search...');
  const searchResults = await orka.knowledge.search('faq', 'how to install', { topK: 2 });
  
  for (const r of searchResults) {
    console.log(`  - [${r.score.toFixed(3)}] ${r.content?.slice(0, 80)}...`);
  }

  console.log('\n💬 Question with RAG...');
  const answer = await orka.ask({
    knowledge: 'faq',
    question: 'What vector databases are supported?',
    includeContext: true,
  });

  console.log(`\n📝 Response: ${answer.answer}`);
  console.log(`\n📊 Stats:`);
  console.log(`  - Tokens: ${answer.usage.totalTokens}`);
  console.log(`  - Latence: ${answer.latencyMs}ms`);
  
  if (answer.context) {
    console.log(`  - Sources used: ${answer.context.length}`);
  }

  console.log('\n🧹 Cleaning up...');
  await orka.knowledge.delete('faq');
  console.log('✅ Base deleted');
}

main().catch(console.error);
