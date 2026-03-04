import { 
  createOrka, 
  OpenAIAdapter, 
  MemoryVectorAdapter,
  RouterLLM,
  ConsensusLLM,
  RaceLLM,
  LoadBalancerLLM,
} from '../src/index.js';


async function routerExample() {
  console.log('🔀 Router: Route by complexity\n');

  const fast = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o-mini' });
  const smart = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o' });

  const llm = new RouterLLM({
    routes: [
      {
        name: 'complex',
        condition: (prompt) => prompt.length > 500 || prompt.includes('analyse') || prompt.includes('compare'),
        adapter: smart,
      },
      {
        name: 'code',
        condition: (prompt) => prompt.includes('code') || prompt.includes('function') || prompt.includes('```'),
        adapter: smart,
      },
    ],
    defaultAdapter: fast,
  });

  const orka = createOrka({ llm, vectorDB: new MemoryVectorAdapter() });

  const simple = await orka.generate('Say hello in one sentence.');
  console.log(`Simple (gpt-4o-mini): ${simple}\n`);
}

async function consensusExample() {
  console.log('🤝 Consensus: Best response from 2 models\n');

  const llm = new ConsensusLLM({
    adapters: [
      new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o-mini' }),
      new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o' }),
    ],
    strategy: 'best_score',
    judge: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o' }),
  });

  const orka = createOrka({ llm, vectorDB: new MemoryVectorAdapter() });
  const result = await orka.generate('Explain recursion in programming.');
  console.log(`Consensus: ${result.slice(0, 200)}...\n`);
}

async function raceExample() {
  console.log('🏎️  Race: The fastest wins\n');

  const llm = new RaceLLM({
    adapters: [
      new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o-mini' }),
      new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o' }),
    ],
    timeout: 10000,
  });

  const orka = createOrka({ llm, vectorDB: new MemoryVectorAdapter() });
  const result = await orka.generate('What is TypeScript?');
  console.log(`Race winner: ${result.slice(0, 200)}...\n`);
}

async function loadBalancerExample() {
  console.log('⚖️  Load Balancer: Round-robin\n');

  const lb = new LoadBalancerLLM({
    adapters: [
      new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o-mini' }),
      new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o-mini' }),
    ],
    strategy: 'round_robin',
  });

  const orka = createOrka({ llm: lb, vectorDB: new MemoryVectorAdapter() });

  for (let i = 0; i < 4; i++) {
    await orka.generate(`Question ${i + 1}`);
  }

  console.log('Stats:', lb.getStats());
}

async function main() {
  await routerExample();
  await consensusExample();
  await raceExample();
  await loadBalancerExample();
}

main().catch(console.error);
