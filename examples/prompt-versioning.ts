import { 
  createOrka, 
  OpenAIAdapter, 
  MemoryVectorAdapter,
  FilePromptPersistence,
} from '../src/index.js';

async function main() {
  const orka = createOrka({
    llm: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
    vectorDB: new MemoryVectorAdapter(),
    prompts: {
      persistence: new FilePromptPersistence('./prompts.json'),
    },
  });

  // Register prompt versions
  console.log('📝 Registering prompt versions...\n');

  orka.prompts.register('support-answer', 
    'Answer the following customer question:\n\nQuestion: {{ question }}\n\nAnswer concisely.',
    { author: 'v1', description: 'Basic support prompt' }
  );

  orka.prompts.register('support-answer', 
    'You are a professional support agent. Answer the customer question based on the context.\n\nContext: {{ context }}\nQuestion: {{ question }}\n\nProvide a helpful, empathetic answer.',
    { author: 'v2', description: 'Added context and empathy' }
  );

  orka.prompts.register('support-answer', 
    'You are a senior support agent at Acme Corp. Follow these rules:\n1. Be empathetic\n2. Be concise\n3. Always suggest next steps\n\nContext: {{ context }}\nQuestion: {{ question }}\n\nAnswer:',
    { author: 'v3', description: 'Added rules and brand' }
  );

  // List versions
  const versions = orka.prompts.getVersions('support-answer');
  console.log(`Versions: ${versions.length}`);
  for (const v of versions) {
    console.log(`  v${v.version} (${v.isActive ? 'ACTIVE' : 'inactive'}) - vars: ${v.variables.join(', ')}`);
  }

  // Render a prompt
  console.log('\n🔄 Rendering active version...\n');
  const rendered = orka.prompts.render('support-answer', {
    variables: {
      context: 'Refunds take 5 business days.',
      question: 'Quand vais-je recevoir mon remboursement ?',
    },
  });
  console.log(rendered);

  // Render a specific version
  console.log('\n🔄 Rendering v1...\n');
  const renderedV1 = orka.prompts.render('support-answer', {
    variables: { question: 'Quand vais-je recevoir mon remboursement ?' },
    version: 1,
  });
  console.log(renderedV1);

  // Diff between versions
  console.log('\n📊 Diff v1 → v3:\n');
  const diff = orka.prompts.diff('support-answer', 1, 3);
  for (const change of diff.changes) {
    console.log(`  ${change.type.toUpperCase()} [${change.field}]`);
    if (change.oldValue) console.log(`    - ${change.oldValue.slice(0, 60)}...`);
    if (change.newValue) console.log(`    + ${change.newValue.slice(0, 60)}...`);
  }

  // Rollback
  console.log('\n⏪ Rolling back...');
  orka.prompts.rollback('support-answer');
  console.log(`Active version: v${orka.prompts.getActiveVersion('support-answer')}`);

  // Use in generate
  console.log('\n💬 Using prompt in LLM call...\n');
  const prompt = orka.prompts.render('support-answer', {
    variables: {
      context: 'Refunds take 5 business days after validation.',
      question: 'When will I receive my refund?',
    },
  });
  const answer = await orka.generate(prompt);
  console.log(`Answer: ${answer}`);

  // Save prompts
  await orka.prompts.save();
  console.log('\n✅ Prompts saved to prompts.json');
}

main().catch(console.error);
