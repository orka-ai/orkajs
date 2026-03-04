import { 
  createOrka, 
  OpenAIAdapter, 
  MemoryVectorAdapter,
  type EvalCase,
} from '../src/index.js';

async function main() {
  const orka = createOrka({
    llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
    vectorDB: new MemoryVectorAdapter(),
  });

  // Create a knowledge base
  await orka.knowledge.create({
    name: 'docs',
    source: [
      'Orka JS is a TypeScript framework for building production-ready LLM systems.',
      'Orka supports OpenAI, Anthropic, Mistral, and Ollama as LLM providers.',
      'Vector databases supported: Pinecone, Qdrant, Chroma, and an in-memory adapter.',
      'Chunking is automatic with a default size of 1000 characters and an overlap of 200.',
      'Orka includes an integrated evaluation system to test response quality.',
    ],
  });

  // Define the test dataset
  const dataset: EvalCase[] = [
    {
      input: 'What is Orka JS?',
      expectedOutput: 'Orka JS is a TypeScript framework for building production-ready LLM systems.',
      knowledge: 'docs',
    },
    {
      input: 'What LLM providers are supported?',
      expectedOutput: 'OpenAI, Anthropic, Mistral, and Ollama.',
      knowledge: 'docs',
    },
    {
      input: 'What vector databases can be used?',
      expectedOutput: 'Pinecone, Qdrant, Chroma, and an in-memory adapter.',
      knowledge: 'docs',
    },
    {
      input: 'How does chunking work?',
      expectedOutput: 'Chunking is automatic with a default size of 1000 characters and an overlap of 200.',
      knowledge: 'docs',
    },
  ];

  console.log('🧪 Evaluation in progress...\n');

  const summary = await orka.evaluate({
    dataset,
    metrics: ['relevance', 'correctness', 'faithfulness', 'hallucination'],
    onResult: (result, index) => {
      const scores = result.metrics.map(m => `${m.name}=${m.score.toFixed(2)}`).join(', ');
      console.log(`  [${index + 1}/${dataset.length}] "${result.input.slice(0, 40)}..." → ${scores}`);
    },
  });

  console.log('\n📊 Summary:');
  console.log(`  Total: ${summary.totalCases} cases`);
  console.log(`  Average latency: ${Math.round(summary.averageLatencyMs)}ms`);
  console.log(`  Total tokens: ${summary.totalTokens}`);
  console.log('\n  Metrics:');
  for (const [name, stats] of Object.entries(summary.metrics)) {
    console.log(`    ${name}: avg=${stats.average.toFixed(2)}, min=${stats.min.toFixed(2)}, max=${stats.max.toFixed(2)}`);
  }

  // Cleanup
  await orka.knowledge.delete('docs');
}

main().catch(console.error);
