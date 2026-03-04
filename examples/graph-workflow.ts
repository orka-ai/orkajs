import { 
  createOrka, 
  OpenAIAdapter, 
  MemoryVectorAdapter,
  startNode,
  endNode,
  actionNode,
  conditionNode,
  llmNode,
  retrieveNode,
  edge
} from '../src/index.js';

async function main() {
  const orka = createOrka({
    llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
    vectorDB: new MemoryVectorAdapter(),
  });

  // Create a knowledge base
  await orka.knowledge.create({
    name: 'faq',
    source: [
      { text: 'To reset your password, go to Settings > Security.', metadata: { topic: 'password' } },
      { text: 'Refunds are processed within 5 business days.', metadata: { topic: 'refund' } },
      { text: 'Contact us at support@example.com for any questions.', metadata: { topic: 'contact' } },
    ],
  });

  // Graph workflow with conditions and branches
  const graph = orka.graph({
    name: 'smart-support',
    nodes: [
      startNode('start'),

      // Classify the question
      actionNode('classify', async (ctx) => {
        const result = await ctx.llm.generate(
          `Classify this question into one category: "technical", "billing", or "general".\nQuestion: ${ctx.input}\nRespond with ONLY the category.`,
          { temperature: 0, maxTokens: 10 }
        );
        ctx.output = result.content.trim().toLowerCase();
        ctx.metadata.category = ctx.output;
        return ctx;
      }),

      // Conditional router
      conditionNode('router', (ctx) => {
        const category = (ctx.metadata.category as string) ?? 'general';
        if (category.includes('technical')) return 'technical';
        if (category.includes('billing')) return 'billing';
        return 'general';
      }),

      // Technical branch: RAG
      retrieveNode('tech-retrieve', 'faq', { topK: 3 }),
      llmNode('tech-answer', {
        systemPrompt: 'You are a technical expert. Respond based on the context.',
        temperature: 0.3,
        promptTemplate: 'Context:\n{{context}}\n\nTechnical question: {{input}}',
      }),

      // Billing branch: direct answer
      llmNode('billing-answer', {
        systemPrompt: 'You are a billing expert. Be precise and professional.',
        temperature: 0.3,
      }),

      // General branch
      llmNode('general-answer', {
        systemPrompt: 'You are a general support assistant. Be helpful and concise.',
        temperature: 0.5,
      }),

      endNode('end'),
    ],
    edges: [
      edge('start', 'classify'),
      edge('classify', 'router'),
      edge('router', 'tech-retrieve', 'technical'),
      edge('router', 'billing-answer', 'billing'),
      edge('router', 'general-answer', 'general'),
      edge('tech-retrieve', 'tech-answer'),
      edge('tech-answer', 'end'),
      edge('billing-answer', 'end'),
      edge('general-answer', 'end'),
    ],
    onNodeComplete: (nodeId, ctx) => {
      console.log(`  ✅ Node "${nodeId}" → ${ctx.output.slice(0, 60)}...`);
    },
  });

  // Visualize the graph
  console.log('📊 Graph Mermaid:\n');
  console.log(graph.toMermaid());

  // Run
  console.log('\n🔄 Running graph workflow...\n');
  const result = await graph.run('Comment réinitialiser mon mot de passe ?');

  console.log(`\n📝 Output: ${result.output}`);
  console.log(`📊 Path: ${result.path.join(' → ')}`);
  console.log(`⏱️  Latency: ${result.totalLatencyMs}ms`);
  console.log(`🏷️  Category: ${result.metadata.category}`);

  await orka.knowledge.delete('faq');
}

main().catch(console.error);
