#!/usr/bin/env node

/**
 * Script to replace workspace:* dependencies with actual versions
 * Run this before publishing packages to npm
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const packagesDir = join(process.cwd(), 'packages');
const packages = readdirSync(packagesDir);

// First pass: collect all package versions
const versions = {};
packages.forEach(pkg => {
  const pkgJsonPath = join(packagesDir, pkg, 'package.json');
  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    versions[pkgJson.name] = pkgJson.version;
  } catch (e) {
    // Skip if package.json doesn't exist
  }
});

console.log('📦 Found packages:', Object.keys(versions).length);

// Second pass: replace workspace:* with actual versions
let totalReplaced = 0;
packages.forEach(pkg => {
  const pkgJsonPath = join(packagesDir, pkg, 'package.json');
  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    let modified = false;

    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
      if (pkgJson[depType]) {
        Object.keys(pkgJson[depType]).forEach(depName => {
          if (pkgJson[depType][depName] === 'workspace:*' && versions[depName]) {
            pkgJson[depType][depName] = `^${versions[depName]}`;
            modified = true;
            totalReplaced++;
            console.log(`  ✓ ${pkg}: ${depName} workspace:* → ^${versions[depName]}`);
          }
        });
      }
    });

    if (modified) {
      writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
    }
  } catch (e) {
    // Skip if package.json doesn't exist
  }
});

console.log(`\n✅ Replaced ${totalReplaced} workspace:* dependencies`);
console.log('🚀 Ready to publish!');
