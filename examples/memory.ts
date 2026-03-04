import { 
  createOrka, 
  OpenAIAdapter, 
  MemoryVectorAdapter,
} from '../src/index.js';

async function main() {
  const orka = createOrka({
    llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
    vectorDB: new MemoryVectorAdapter(),
    memory: {
      maxMessages: 20,
      strategy: 'sliding_window',
    },
  });

  // Simple memory (single conversation)
  console.log('💬 Chat with memory\n');

  const memory = orka.memory();
  memory.addMessage({ role: 'user', content: 'My name is Thomas.' });
  memory.addMessage({ role: 'assistant', content: 'Hello Thomas! How can I help you?' });
  memory.addMessage({ role: 'user', content: 'I\'m looking for a laptop for development.' });

  console.log('History:');
  for (const msg of memory.getHistory()) {
    console.log(`  ${msg.role}: ${msg.content}`);
  }

  // Sessions multiples
  console.log('\n📋 Sessions multiples\n');

  const sessions = orka.sessions();

  sessions.addMessage('user-123', { role: 'user', content: 'Hello, I want a refund.' });
  sessions.addMessage('user-123', { role: 'assistant', content: 'Of course, what is your order number?' });

  sessions.addMessage('user-456', { role: 'user', content: 'How do I change my password?' });
  sessions.addMessage('user-456', { role: 'assistant', content: 'Go to Settings > Security.' });

  console.log(`Sessions actives: ${sessions.getSessionCount()}`);
  console.log(`Session user-123: ${sessions.getHistory('user-123').length} messages`);
  console.log(`Session user-456: ${sessions.getHistory('user-456').length} messages`);

  // Agent with memory
  console.log('\n🤖 Agent with conversation memory\n');

  const agent = orka.agent({
    goal: 'Aider les utilisateurs',
    tools: [{
      name: 'search',
      description: 'Recherche dans la documentation',
      async execute(input) {
        return { output: `Résultat pour "${input.query}": Documentation trouvée.` };
      },
    }],
    maxSteps: 3,
  });

  const result = await agent.run('Remember that my name is Thomas and I\'m looking for a laptop.');
  console.log(`Agent: ${result.output}`);
}

main().catch(console.error);
