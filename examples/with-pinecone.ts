import { createOrka, OpenAIAdapter, PineconeAdapter } from '../src/index.js';

async function main() {
  const orka = createOrka({
    llm: new OpenAIAdapter({ 
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini',
    }),
    vectorDB: new PineconeAdapter({
      apiKey: process.env.PINECONE_API_KEY!,
      indexHost: process.env.PINECONE_INDEX_HOST!,
    }),
  });

  await orka.knowledge.create({
    name: 'products',
    source: [
      { text: 'iPhone 15 Pro - The most advanced smartphone with A17 Pro chip.', metadata: { type: 'phone' } },
      { text: 'MacBook Pro M3 - Exceptional performance for professionals.', metadata: { type: 'laptop' } },
      { text: 'AirPods Pro 2 - Spatial audio and active noise cancellation.', metadata: { type: 'audio' } },
    ],
  });

  const result = await orka.ask({
    knowledge: 'products',
    question: 'Which product would you recommend for a developer?',
  });

  console.log(result.answer);

  await orka.knowledge.delete('products');
}

main().catch(console.error);
