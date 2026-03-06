#!/usr/bin/env node
/**
 * Generate subpath export files for compatibility with moduleResolution: "node"
 * This creates .js and .d.ts files at the package root for each export path
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
  
  // Calculate relative paths from the subpath location to dist
  const subpathDir = dirname(subpath);
  const subpathParts = subpath.split('/');
  // For "adapters/memory" -> depth is 1 (we're in adapters/ folder, need to go up 1 level)
  // For "core" -> depth is 0 (we're at root, need to go up 0 levels, just use ./)
  const depth = subpathParts.length - 1;
  const prefix = depth > 0 ? '../'.repeat(depth) : './';
  
  // Create directory if needed
  const fullDir = join(rootDir, subpathDir);
  if (subpathDir && subpathDir !== '.' && !createdDirs.has(fullDir)) {
    if (!existsSync(fullDir)) {
      mkdirSync(fullDir, { recursive: true });
      console.log(`Created directory: ${subpathDir}/`);
    }
    createdDirs.add(fullDir);
  }
  
  // Create .js file (CommonJS redirect)
  const jsFilePath = join(rootDir, `${subpath}.js`);
  const jsContent = `module.exports = require('${prefix}${cjsPath.slice(2)}');\n`;
  writeFileSync(jsFilePath, jsContent);
  createdFiles.push(`${subpath}.js`);
  
  // Create .d.ts file (TypeScript types redirect)
  const dtsFilePath = join(rootDir, `${subpath}.d.ts`);
  // Remove .d.ts extension from the path for the export statement
  const typesImportPath = typesPath.slice(2).replace(/\.d\.ts$/, '');
  const dtsContent = `export * from '${prefix}${typesImportPath}';\n`;
  writeFileSync(dtsFilePath, dtsContent);
  createdFiles.push(`${subpath}.d.ts`);
  
  console.log(`Created: ${subpath}.js, ${subpath}.d.ts`);
}

console.log(`\n✅ Generated ${createdFiles.length} files for ${Object.keys(exports).length - 1} subpath exports`);

// Output the list of files/dirs to add to package.json "files" array
const dirsToAdd = [...new Set(createdFiles.map(f => {
  const parts = f.split('/');
  return parts.length > 1 ? parts[0] : null;
}).filter(Boolean))];

console.log('\n📦 Add these to your package.json "files" array:');
dirsToAdd.forEach(d => console.log(`  "${d}",`));
