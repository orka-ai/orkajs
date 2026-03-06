#!/usr/bin/env node
/**
 * Generate subpath export files for compatibility with moduleResolution: "node"
 * 
 * All redirect files are placed inside subdirectories (never at root).
 * - "./core"            → core/index.js + core/index.d.ts
 * - "./core/chunker"    → core/chunker.js + core/chunker.d.ts
 * - "./adapters/memory"  → adapters/memory.js + adapters/memory.d.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read package.json
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const exports = packageJson.exports;

// Track created directories and files
const createdDirs = new Set();
const createdFiles = [];

for (const [exportPath, exportConfig] of Object.entries(exports)) {
  // Skip the root export "."
  if (exportPath === '.') continue;
  
  // Get the subpath without leading "./"
  const subpath = exportPath.slice(2); // Remove "./"
  
  // Get the dist path from the export config
  const typesPath = exportConfig.types;
  const cjsPath = exportConfig.require;
  
  if (!typesPath || !cjsPath) {
    console.warn(`Skipping ${exportPath}: missing types or require path`);
    continue;
  }
  
  // Determine file paths:
  // Single-segment paths like "core" → core/index.js (inside subdirectory)
  // Multi-segment paths like "adapters/memory" → adapters/memory.js (already in subdirectory)
  const segments = subpath.split('/');
  const isSingleSegment = segments.length === 1;
  
  let targetDir, jsFileName, dtsFileName, relativeLabel;
  
  if (isSingleSegment) {
    // "./core" → core/index.js, core/index.d.ts
    targetDir = join(rootDir, subpath);
    jsFileName = 'index.js';
    dtsFileName = 'index.d.ts';
    relativeLabel = `${subpath}/index`;
  } else {
    // "./adapters/memory" → adapters/memory.js, adapters/memory.d.ts
    targetDir = join(rootDir, dirname(subpath));
    const baseName = segments[segments.length - 1];
    jsFileName = `${baseName}.js`;
    dtsFileName = `${baseName}.d.ts`;
    relativeLabel = subpath;
  }
  
  // Calculate the depth from target directory to root for relative path to dist/
  const targetRelative = isSingleSegment ? subpath : dirname(subpath);
  const depth = targetRelative.split('/').length;
  const prefix = '../'.repeat(depth);
  
  // Create directory if needed
  if (!createdDirs.has(targetDir)) {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    createdDirs.add(targetDir);
  }
  
  // Create .js file (CommonJS redirect)
  const jsFilePath = join(targetDir, jsFileName);
  const jsContent = `module.exports = require('${prefix}${cjsPath.slice(2)}');\n`;
  writeFileSync(jsFilePath, jsContent);
  createdFiles.push(`${relativeLabel}.js`);
  
  // Create .d.ts file (TypeScript types redirect)
  const dtsFilePath = join(targetDir, dtsFileName);
  const typesImportPath = typesPath.slice(2).replace(/\.d\.ts$/, '');
  const dtsContent = `export * from '${prefix}${typesImportPath}';\n`;
  writeFileSync(dtsFilePath, dtsContent);
  createdFiles.push(`${relativeLabel}.d.ts`);
  
  console.log(`Created: ${relativeLabel}.js, ${relativeLabel}.d.ts`);
}

console.log(`\n✅ Generated ${createdFiles.length} files for ${Object.keys(exports).length - 1} subpath exports`);

// Output the list of top-level directories to add to package.json "files" array
const dirsToAdd = [...new Set(createdFiles.map(f => f.split('/')[0]))].sort();

console.log('\n📦 Add these directories to your package.json "files" array:');
dirsToAdd.forEach(d => console.log(`  "${d}",`));
