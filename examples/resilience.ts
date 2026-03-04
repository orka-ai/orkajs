import { 
  createOrka, 
  OpenAIAdapter, 
  AnthropicAdapter,
  OllamaAdapter,
  MemoryVectorAdapter,
  FallbackLLM,
  withRetry,
} from '../src/index.js';

async function main() {
  // Fallback: if OpenAI fails → Anthropic → Ollama local
  const llm = new FallbackLLM({
    adapters: [
      new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
      new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! }),
      new OllamaAdapter({ model: 'llama3.2' }),
    ],
    onFallback: (error, failed, next) => {
      console.log(`⚠️  ${failed} failed (${error.message}), falling back to ${next}`);
    },
  });

  const orka = createOrka({
    llm,
    vectorDB: new MemoryVectorAdapter(),
  });

  // Retry: automatically retry in case of network error
  const result = await withRetry(
    () => orka.ask({ question: 'Explain TypeScript in one sentence.' }),
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      retryableErrors: ['rate limit', 'timeout', '429', '500', '503'],
      onRetry: (error, attempt) => {
        console.log(`🔄 Retry ${attempt}: ${error.message}`);
      },
    },
  );

  console.log(`✅ Response: ${result.answer}`);
  console.log(`📊 Tokens: ${result.usage.totalTokens}, Latency: ${result.latencyMs}ms`);
}

main().catch(console.error);
