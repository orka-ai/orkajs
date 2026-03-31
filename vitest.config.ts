import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@orka-js/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@orka-js/openai': resolve(__dirname, 'packages/openai/src/index.ts'),
      '@orka-js/anthropic': resolve(__dirname, 'packages/anthropic/src/index.ts'),
      '@orka-js/mistral': resolve(__dirname, 'packages/mistral/src/index.ts'),
      '@orka-js/ollama': resolve(__dirname, 'packages/ollama/src/index.ts'),
      '@orka-js/memory': resolve(__dirname, 'packages/memory/src/index.ts'),
      '@orka-js/pinecone': resolve(__dirname, 'packages/pinecone/src/index.ts'),
      '@orka-js/qdrant': resolve(__dirname, 'packages/qdrant/src/index.ts'),
      '@orka-js/chroma': resolve(__dirname, 'packages/chroma/src/index.ts'),
      '@orka-js/agent': resolve(__dirname, 'packages/agent/src/index.ts'),
      '@orka-js/tools': resolve(__dirname, 'packages/tools/src/index.ts'),
      '@orka-js/cache': resolve(__dirname, 'packages/cache/src/index.ts'),
      '@orka-js/resilience': resolve(__dirname, 'packages/resilience/src/index.ts'),
      '@orka-js/orchestration': resolve(__dirname, 'packages/orchestration/src/index.ts'),
      '@orka-js/workflow': resolve(__dirname, 'packages/workflow/src/index.ts'),
      '@orka-js/graph': resolve(__dirname, 'packages/graph/src/index.ts'),
      '@orka-js/evaluation': resolve(__dirname, 'packages/evaluation/src/index.ts'),
      '@orka-js/observability': resolve(__dirname, 'packages/observability/src/index.ts'),
      '@orka-js/prompts': resolve(__dirname, 'packages/prompts/src/index.ts'),
      '@orka-js/memory-store': resolve(__dirname, 'packages/memory-store/src/index.ts'),
      '@orka-js/pgvector': resolve(__dirname, 'packages/pgvector/src/index.ts'),
      '@orka-js/otel': resolve(__dirname, 'packages/otel/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/*/src/**/*.d.ts'],
    },
    testTimeout: 10000,
  },
});
