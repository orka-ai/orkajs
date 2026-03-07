import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = join(__dirname, '../..');
const DIST_DIR = join(ROOT_DIR, 'dist');

describe('Build Output', () => {
  beforeAll(() => {
    // Ensure build is run before tests
    if (!existsSync(join(DIST_DIR, 'index.js'))) {
      console.log('Running build...');
      execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    }
  });

  describe('ESM Output', () => {
    it('should generate index.js (ESM)', () => {
      expect(existsSync(join(DIST_DIR, 'index.js'))).toBe(true);
    });

    it('should generate ESM files for all entry points', () => {
      const esmFiles = [
        'index.js',
        'core/orka.js',
        'core/knowledge.js',
        'adapters/openai.js',
        'adapters/anthropic.js',
        'adapters/memory.js',
        'cache/index.js',
        'cache/memory-cache.js',
        'parsers/index.js',
        'parsers/json-parser.js',
        'templates/index.js',
        'templates/prompt-template.js',
        'splitters/index.js',
        'agent/index.js',
        'chains/index.js',
        'errors/index.js',
      ];

      for (const file of esmFiles) {
        const filePath = join(DIST_DIR, file);
        expect(existsSync(filePath), `Missing ESM file: ${file}`).toBe(true);
      }
    });

    it('should use ESM export syntax', () => {
      const indexContent = readFileSync(join(DIST_DIR, 'index.js'), 'utf-8');
      expect(indexContent).toMatch(/export\s*\{/);
    });
  });

  describe('CJS Output', () => {
    it('should generate index.cjs (CommonJS)', () => {
      expect(existsSync(join(DIST_DIR, 'index.cjs'))).toBe(true);
    });

    it('should generate CJS files for all entry points', () => {
      const cjsFiles = [
        'index.cjs',
        'core/orka.cjs',
        'adapters/openai.cjs',
        'cache/index.cjs',
        'parsers/index.cjs',
        'templates/index.cjs',
        'agent/index.cjs',
      ];

      for (const file of cjsFiles) {
        const filePath = join(DIST_DIR, file);
        expect(existsSync(filePath), `Missing CJS file: ${file}`).toBe(true);
      }
    });

    it('should use CJS require syntax', () => {
      const indexContent = readFileSync(join(DIST_DIR, 'index.cjs'), 'utf-8');
      // tsup generates CJS with require() calls
      expect(indexContent).toMatch(/require\(/);
    });
  });

  describe('TypeScript Declarations', () => {
    it('should generate index.d.ts', () => {
      expect(existsSync(join(DIST_DIR, 'index.d.ts'))).toBe(true);
    });

    it('should generate .d.ts files for all entry points', () => {
      const dtsFiles = [
        'index.d.ts',
        'core/orka.d.ts',
        'adapters/openai.d.ts',
        'cache/index.d.ts',
        'parsers/index.d.ts',
        'templates/index.d.ts',
        'agent/index.d.ts',
        'errors/index.d.ts',
      ];

      for (const file of dtsFiles) {
        const filePath = join(DIST_DIR, file);
        expect(existsSync(filePath), `Missing DTS file: ${file}`).toBe(true);
      }
    });

    it('should export types correctly', () => {
      const indexDts = readFileSync(join(DIST_DIR, 'index.d.ts'), 'utf-8');
      expect(indexDts).toMatch(/export/);
    });
  });

  describe('Source Maps', () => {
    it('should generate source maps for ESM', () => {
      expect(existsSync(join(DIST_DIR, 'index.js.map'))).toBe(true);
    });
  });
});

describe('Package.json Exports', () => {
  let packageJson: Record<string, unknown>;

  beforeAll(() => {
    packageJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));
  });

  it('should have main entry point', () => {
    expect(packageJson.main).toBe('dist/index.js');
  });

  it('should have module entry point', () => {
    expect(packageJson.module).toBe('dist/index.js');
  });

  it('should have types entry point', () => {
    expect(packageJson.types).toBe('dist/index.d.ts');
  });

  it('should have exports field', () => {
    expect(packageJson.exports).toBeDefined();
  });

  it('should have correct main export structure', () => {
    const exports = packageJson.exports as Record<string, Record<string, string>>;
    expect(exports['.']).toBeDefined();
    expect(exports['.'].types).toBe('./dist/index.d.ts');
    expect(exports['.'].import).toBe('./dist/index.js');
    expect(exports['.'].require).toBe('./dist/index.cjs');
  });

  it('should have subpath exports for adapters', () => {
    const exports = packageJson.exports as Record<string, Record<string, string>>;
    expect(exports['./adapters/openai']).toBeDefined();
    expect(exports['./adapters/anthropic']).toBeDefined();
    expect(exports['./adapters/memory']).toBeDefined();
  });

  it('should have subpath exports for parsers', () => {
    const exports = packageJson.exports as Record<string, Record<string, string>>;
    expect(exports['./parsers']).toBeDefined();
    expect(exports['./parsers/json']).toBeDefined();
  });

  it('should have subpath exports for cache', () => {
    const exports = packageJson.exports as Record<string, Record<string, string>>;
    expect(exports['./cache']).toBeDefined();
    expect(exports['./cache/memory']).toBeDefined();
  });

  it('should have subpath exports for agents', () => {
    const exports = packageJson.exports as Record<string, Record<string, string>>;
    expect(exports['./agent']).toBeDefined();
    expect(exports['./agent/react']).toBeDefined();
  });

  it('should be marked as ESM package', () => {
    expect(packageJson.type).toBe('module');
  });

  it('should have sideEffects false for tree-shaking', () => {
    expect(packageJson.sideEffects).toBe(false);
  });
});
