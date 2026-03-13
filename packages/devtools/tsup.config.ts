import { defineConfig } from 'tsup';
import { copyFileSync } from 'fs';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  external: ['express'],
  onSuccess: async () => {
    copyFileSync('src/dashboard.html', 'dist/dashboard.html');
    console.log('📋 Copied dashboard.html to dist/');
  },
});
