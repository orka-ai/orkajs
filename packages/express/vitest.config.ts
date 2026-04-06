import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@orka-js/core': resolve(__dirname, '../core/src/index.ts'),
      '@orka-js/agent': resolve(__dirname, '../agent/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
