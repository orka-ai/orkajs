import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@orkajs/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@orkajs/openai': resolve(__dirname, 'packages/openai/src/index.ts'),
      '@orkajs/anthropic': resolve(__dirname, 'packages/anthropic/src/index.ts'),
      '@orkajs/mistral': resolve(__dirname, 'packages/mistral/src/index.ts'),
      '@orkajs/ollama': resolve(__dirname, 'packages/ollama/src/index.ts'),
      '@orkajs/memory': resolve(__dirname, 'packages/memory/src/index.ts'),
      '@orkajs/pinecone': resolve(__dirname, 'packages/pinecone/src/index.ts'),
      '@orkajs/qdrant': resolve(__dirname, 'packages/qdrant/src/index.ts'),
      '@orkajs/chroma': resolve(__dirname, 'packages/chroma/src/index.ts'),
      '@orkajs/agent': resolve(__dirname, 'packages/agent/src/index.ts'),
      '@orkajs/tools': resolve(__dirname, 'packages/tools/src/index.ts'),
      '@orkajs/cache': resolve(__dirname, 'packages/cache/src/index.ts'),
      '@orkajs/resilience': resolve(__dirname, 'packages/resilience/src/index.ts'),
      '@orkajs/orchestration': resolve(__dirname, 'packages/orchestration/src/index.ts'),
      '@orkajs/workflow': resolve(__dirname, 'packages/workflow/src/index.ts'),
      '@orkajs/graph': resolve(__dirname, 'packages/graph/src/index.ts'),
      '@orkajs/evaluation': resolve(__dirname, 'packages/evaluation/src/index.ts'),
      '@orkajs/observability': resolve(__dirname, 'packages/observability/src/index.ts'),
      '@orkajs/prompts': resolve(__dirname, 'packages/prompts/src/index.ts'),
      '@orkajs/memory-store': resolve(__dirname, 'packages/memory-store/src/index.ts'),
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
