#!/usr/bin/env node
/**
 * Generate subpath proxy files for compatibility with moduleResolution: "node".
 *
 * Modern resolvers (bundler, node16, nodenext) use the "exports" field directly.
 * Legacy "node" resolution needs physical files on disk:
 *   import { OpenAIAdapter } from 'orkajs/adapters/openai'
 *   → looks for node_modules/orkajs/adapters/openai.js
 *
 * This script creates thin CJS proxies + .d.ts re-exports at the package root
 * so that ALL moduleResolution modes work.
 *
 * These files are:
 *   - Generated at build time (npm run build)
 *   - Listed in package.json "files" (included in npm publish)
 *   - Listed in .gitignore (excluded from source control)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));

let fileCount = 0;

for (const [exportPath, config] of Object.entries(pkg.exports)) {
  if (exportPath === '.') continue;

  const subpath = exportPath.slice(2); // "./adapters/openai" → "adapters/openai"
  const segments = subpath.split('/');

  // Determine target directory and filenames
  let targetDir, jsFile, dtsFile;

  if (segments.length === 1) {
    // "./core" → core/index.js, core/index.d.ts
    targetDir = join(rootDir, subpath);
    jsFile = 'index.js';
    dtsFile = 'index.d.ts';
  } else {
    // "./adapters/openai" → adapters/openai.js, adapters/openai.d.ts
    targetDir = join(rootDir, segments.slice(0, -1).join('/'));
    jsFile = `${segments[segments.length - 1]}.js`;
    dtsFile = `${segments[segments.length - 1]}.d.ts`;
  }

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Depth from proxy dir back to package root
  const depth = (segments.length === 1 ? subpath : dirname(subpath)).split('/').length;
  const prefix = '../'.repeat(depth);

  // CJS proxy → dist/<path>.cjs
  const cjsTarget = config.require.slice(2); // "./dist/adapters/openai.cjs" → "dist/adapters/openai.cjs"
  writeFileSync(
    join(targetDir, jsFile),
    `module.exports = require('${prefix}${cjsTarget}');\n`
  );

  // .d.ts re-export → dist/<path>.d.ts
  const typesTarget = config.types.slice(2).replace(/\.d\.ts$/, '');
  writeFileSync(
    join(targetDir, dtsFile),
    `export * from '${prefix}${typesTarget}';\n`
  );

  fileCount += 2;
}

console.log(`✅ Generated ${fileCount} proxy files for ${Object.keys(pkg.exports).length - 1} subpath exports`);
