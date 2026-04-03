import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  splitting: false,
  treeshake: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', '@xyflow/react', '@orka-js/core', '@orka-js/graph'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
