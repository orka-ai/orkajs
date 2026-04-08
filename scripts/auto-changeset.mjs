#!/usr/bin/env node
/**
* auto-changeset.js
* Automatically detects packages modified since their last Git tag
* and creates a patch changeset for them.
* Logic:
* - For each package, searches for the Git tag `<name>@<version>`
* - If the tag exists and files have changed in packages/<dir>/ → patch
* - If the tag does not exist (never published or missing tag) → patch
* - If a package is already covered by an existing changeset → skip

*/

import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const root = process.cwd();
const pkgsDir = join(root, 'packages');
const csDir = join(root, '.changeset');

// ── 1. Read the existing changesets to see which packages are already covered. ──
const existingCsFiles = readdirSync(csDir)
  .filter(f => f.endsWith('.md') && f !== 'README.md' && f !== 'config.json');

const coveredPackages = new Set();
for (const file of existingCsFiles) {
  const content = readFileSync(join(csDir, file), 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    for (const line of match[1].split('\n')) {
      const m = line.match(/^"(@[^"]+)":/);
      if (m) coveredPackages.add(m[1]);
    }
  }
}

if (existingCsFiles.length > 0) {
  console.log(`ℹ  ${existingCsFiles.length} changeset(s) exist, packages already covered: ${[...coveredPackages].join(', ') || '(none)'}`);
}

// ── 2. List all packages ──
const allPackages = readdirSync(pkgsDir)
  .filter(dir => existsSync(join(pkgsDir, dir, 'package.json')))
  .map(dir => {
    const pkg = JSON.parse(readFileSync(join(pkgsDir, dir, 'package.json'), 'utf8'));
    return { dir, name: pkg.name, version: pkg.version };
  })
  .filter(p => p.name && p.version && !coveredPackages.has(p.name));

// ── 3. Detect packages modified since their last published tag ──
const changedPackages = [];

for (const pkg of allPackages) {
  const tag = `${pkg.name}@${pkg.version}`;
  const refTag = `refs/tags/${tag}`;

  try {
    // Check if the tag exists
    execSync(`git rev-parse "${refTag}"`, { stdio: 'pipe' });

    // Look for changes since this tag in the package folder
    const diff = execSync(
      `git diff --name-only "${refTag}" HEAD -- "packages/${pkg.dir}/"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (diff) {
      console.log(`📦 ${pkg.name}@${pkg.version} — changes detected`);
      changedPackages.push(pkg);
    }
  } catch {
    // Tag not found → package never published or tag missing
    console.log(`📦 ${pkg.name} — tag "${tag}" not found, adding to bump`);
    changedPackages.push(pkg);
  }
}

if (changedPackages.length === 0) {
  console.log('✅ All packages are up to date, no changeset needed.');
  process.exit(0);
}

// ── 4. Create a patch changeset for the modified packages ──
const id = randomBytes(4).toString('hex');
const frontmatter = changedPackages.map(p => `"${p.name}": patch`).join('\n');
const content = `---\n${frontmatter}\n---\n\nchore: update packages\n`;

writeFileSync(join(csDir, `auto-${id}.md`), content);

console.log(`\n✅ Changeset created: auto-${id}.md (${changedPackages.length} package(s))`);
changedPackages.forEach(p => console.log(`   - ${p.name}`));
