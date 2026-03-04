import { createOrka, OpenAIAdapter, MemoryVectorAdapter } from '../src/index.js';
import { Tracer } from '../src/observability/tracer.js';

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

console.log('🚀 Orka AI observability example');

// Create a plotter with custom hooks
const tracer = new Tracer();
tracer.addHook({
  onTraceStart: (trace) => {
    console.log(`▶️  Trace started: ${trace.name} [${trace.id}]`);
  },
  onTraceEnd: (trace) => {
    console.log(`⏹️  Trace ended: ${trace.name} - ${trace.totalLatencyMs}ms, ${trace.totalTokens} tokens`);
  },
  onEvent: (event) => {
    console.log(`📝 Event: ${event.type}/${event.name} - ${event.latencyMs ?? 0}ms`);
  },
  onError: (error, context) => {
    console.error(`❌ Error: ${error.message}`, context);
  },
});

// Create a knowledge base for testing
await orka.knowledge.create({
  name: 'docs',
  source: [
    'Orka AI is a TypeScript framework for LLM systems.',
    'It supports OpenAI, Anthropic, Mistral and Ollama.',
    'Vector databases: Pinecone, Qdrant, Chroma, in-memory.',
  ],
});

// Start a trace to track the operation
const trace = tracer.startTrace('ask-operation', { question: 'What LLM providers are supported?' });

// Generate a response with observability
const result = await orka.ask({
  knowledge: 'docs',
  question: 'What LLM providers are supported?',
});

// End the trace
tracer.endTrace(trace.id);

// Get traces and calculate metrics
const traces = tracer.getAllTraces();
const totalGenerations = traces.filter(t => t.events.some(e => e.type === 'llm')).length;
const avgLatency = traces.reduce((sum, t) => sum + (t.totalLatencyMs ?? 0), 0) / traces.length;
const totalTokens = traces.reduce((sum, t) => sum + t.totalTokens, 0);
const errorCount = traces.reduce((sum, t) => sum + t.events.filter(e => e.error).length, 0);

console.log('\n📈 Aggregated metrics:');
console.log(`  - Total traces: ${traces.length}`);
console.log(`  - Total generations: ${totalGenerations}`);
console.log(`  - Average latency: ${avgLatency.toFixed(2)}ms`);
console.log(`  - Total tokens: ${totalTokens}`);
console.log(`  - Error rate: ${((errorCount / traces.length) * 100).toFixed(1)}%`);

// Clean up
tracer.clearTraces();
await orka.knowledge.delete('docs');

console.log('✅ Observability example completed');
