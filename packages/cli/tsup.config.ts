import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  dts: false,
  splitting: false,
  treeshake: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  external: ['@clack/prompts', 'fs-extra'],
});
