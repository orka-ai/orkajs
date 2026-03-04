import { 
  createOrka, 
  OpenAIAdapter, 
  MemoryVectorAdapter,
  minScore,
  maxScore,
  maxLatency,
  maxTokens,
  contains,
  ConsoleReporter,
  JsonReporter,
  JUnitReporter,
} from '../src/index.js';

async function main() {
  const orka = createOrka({
    llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
    vectorDB: new MemoryVectorAdapter(),
  });

  // Créer une base de connaissances
  await orka.knowledge.create({
    name: 'docs',
    source: [
      'Orka JS is a TypeScript framework for LLM systems.',
      'Orka supports OpenAI, Anthropic, Mistral, and Ollama.',
      'Vector databases supported: Pinecone, Qdrant, Chroma, in-memory.',
    ],
  });

  // Lancer une suite de tests CI/CD
  console.log('🧪 Running CI test suite...\n');

  const report = await orka.test({
    name: 'Orka AI - Regression Tests',
    dataset: [
      {
        input: 'What is Orka JS?',
        expectedOutput: 'A TypeScript framework for LLM systems.',
        knowledge: 'docs',
      },
      {
        input: 'What LLM providers are supported?',
        expectedOutput: 'OpenAI, Anthropic, Mistral, and Ollama.',
        knowledge: 'docs',
      },
      {
        input: 'What vector databases can be used?',
        expectedOutput: 'Pinecone, Qdrant, Chroma, and in-memory.',
        knowledge: 'docs',
      },
    ],
    metrics: ['relevance', 'correctness', 'faithfulness'],
    assertions: [
      minScore('relevance', 0.7),
      minScore('correctness', 0.5),
      maxScore('hallucination', 0.3),
      maxLatency(10000),
      maxTokens(2000),
    ],
    reporters: [
      new ConsoleReporter(),
      new JsonReporter('./test-results.json'),
      new JUnitReporter('./test-results.xml'),
    ],
    bail: false,
  });

  // Exit code pour CI
  if (report.failed > 0) {
    console.error(`\n❌ ${report.failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n✅ All ${report.passed} tests passed`);
  }

  await orka.knowledge.delete('docs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
