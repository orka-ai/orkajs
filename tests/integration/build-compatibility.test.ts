import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const PACKAGES_DIR = join(__dirname, '../../packages');

const PACKAGES = [
  'core', 'openai', 'anthropic', 'mistral', 'ollama',
  'memory', 'pinecone', 'qdrant', 'chroma',
  'agent', 'tools', 'cache', 'resilience', 'orchestration',
  'workflow', 'graph', 'evaluation', 'observability', 'prompts', 'memory-store',
  'orkajs',
];

describe('Monorepo Build Output', () => {
  for (const pkg of PACKAGES) {
    describe(`@orkajs/${pkg}`, () => {
      const distDir = join(PACKAGES_DIR, pkg, 'dist');

      it('should have ESM output (index.js)', () => {
        expect(existsSync(join(distDir, 'index.js')), `Missing ESM: ${pkg}/dist/index.js`).toBe(true);
      });

      it('should have CJS output (index.cjs)', () => {
        expect(existsSync(join(distDir, 'index.cjs')), `Missing CJS: ${pkg}/dist/index.cjs`).toBe(true);
      });

      it('should have type declarations (index.d.ts)', () => {
        expect(existsSync(join(distDir, 'index.d.ts')), `Missing DTS: ${pkg}/dist/index.d.ts`).toBe(true);
      });

      it('should have source maps', () => {
        expect(existsSync(join(distDir, 'index.js.map')), `Missing sourcemap: ${pkg}/dist/index.js.map`).toBe(true);
      });
    });
  }
});

describe('Package.json Structure', () => {
  for (const pkg of PACKAGES) {
    describe(`@orkajs/${pkg}`, () => {
      let packageJson: Record<string, unknown>;

      beforeAll(() => {
        packageJson = JSON.parse(readFileSync(join(PACKAGES_DIR, pkg, 'package.json'), 'utf-8'));
      });

      it('should have correct exports field', () => {
        const exports = packageJson.exports as Record<string, Record<string, string>>;
        expect(exports['.']).toBeDefined();
        expect(exports['.'].types).toBe('./dist/index.d.ts');
        expect(exports['.'].import).toBe('./dist/index.js');
        expect(exports['.'].require).toBe('./dist/index.cjs');
      });

      it('should be marked as ESM package', () => {
        expect(packageJson.type).toBe('module');
      });

      it('should have sideEffects false for tree-shaking', () => {
        expect(packageJson.sideEffects).toBe(false);
      });

      it('should have build script', () => {
        const scripts = packageJson.scripts as Record<string, string>;
        expect(scripts.build).toBeDefined();
      });
    });
  }
});
