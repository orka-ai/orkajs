import { 
  createOrka, 
  OpenAIAdapter, 
  MemoryVectorAdapter,
  plan,
  retrieve,
  generate,
  verify,
  improve,
} from '../src/index.js';

async function main() {
  const orka = createOrka({
    llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
    vectorDB: new MemoryVectorAdapter(),
  });

  // Create knowledge base
  await orka.knowledge.create({
    name: 'support',
    source: [
      { text: 'To reset your password, go to Settings > Security > Reset.', metadata: { topic: 'password' } },
      { text: 'Refunds are processed within 5 business days after validation.', metadata: { topic: 'refund' } },
      { text: 'Our support is available Monday to Friday, 9am to 6pm.', metadata: { topic: 'hours' } },
      { text: 'To contact support, send an email to support@example.com or call 01 23 45 67 89.', metadata: { topic: 'contact' } },
    ],
  });

  // Create workflow
  const supportWorkflow = orka.workflow({
    name: 'support-response',
    steps: [
      plan(),
      retrieve('support', { topK: 3 }),
      generate({ systemPrompt: 'You are a professional and empathetic customer support agent.' }),
      verify({ criteria: [
        'The response is relevant to the question',
        'The response is based on the provided context',
        'The response is professional and empathetic',
      ]}),
      improve({ maxIterations: 1 }),
    ],
    onStepComplete: (step) => {
      console.log(`  ✅ Step "${step.stepName}" completed (${step.latencyMs}ms)`);
    },
    maxRetries: 1,
  });

  console.log('🔄 Running workflow...\n');
  const result = await supportWorkflow.run('How can I reset my password?');

  console.log(`\n📝 Output: ${result.output}`);
  console.log(`\n📊 Stats:`);
  console.log(`  - Steps: ${result.steps.length}`);
  console.log(`  - Total latency: ${result.totalLatencyMs}ms`);
  console.log(`  - Total tokens: ${result.totalTokens}`);

  // Cleanup
  await orka.knowledge.delete('support');
}

main().catch(console.error);
