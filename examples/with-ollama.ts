import { createOrka, OllamaAdapter, MemoryVectorAdapter } from '../src/index.js';

async function main() {
  const orka = createOrka({
    llm: new OllamaAdapter({ 
      model: 'llama3.2',
      embeddingModel: 'nomic-embed-text',
      baseURL: 'http://localhost:11434',
    }),
    vectorDB: new MemoryVectorAdapter(),
  });

  await orka.knowledge.create({
    name: 'docs',
    source: `
      TypeScript is a programming language developed by Microsoft.
      It adds a static type system to JavaScript.
      TypeScript compiles to JavaScript and can be used everywhere JavaScript works.
    `,
  });

  const result = await orka.ask({
    knowledge: 'docs',
    question: 'What is TypeScript?',
  });

  console.log(result.answer);
  console.log(`Latency: ${result.latencyMs}ms`);
}

main().catch(console.error);
