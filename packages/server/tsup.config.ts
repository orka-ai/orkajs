import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  treeshake: true,
  clean: false, // vite build runs first and puts files in dist/ui/
  sourcemap: true,
  external: ['@orka-js/core', '@orka-js/agent', 'express', 'ws', 'serve-static'],
});
