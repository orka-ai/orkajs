#!/usr/bin/env node
/**
 * auto-changeset.js
 *
 * Détecte automatiquement les packages modifiés depuis leur dernier tag git
 * et crée un patch changeset pour eux.
 *
 * Logique :
 * - Pour chaque package, cherche le tag git `<name>@<version>`
 * - Si le tag existe et que des fichiers ont changé dans packages/<dir>/ → patch
 * - Si le tag n'existe pas (jamais publié ou tag manquant) → patch
 * - Si un package est déjà couvert par un changeset existant → skip
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const root = process.cwd();
const pkgsDir = join(root, 'packages');
const csDir = join(root, '.changeset');

// ── 1. Lire les changesets existants pour savoir quels packages sont déjà couverts ──
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
  console.log(`ℹ  ${existingCsFiles.length} changeset(s) existant(s), packages déjà couverts : ${[...coveredPackages].join(', ') || '(aucun)'}`);
}

// ── 2. Lister tous les packages ──
const allPackages = readdirSync(pkgsDir)
  .filter(dir => existsSync(join(pkgsDir, dir, 'package.json')))
  .map(dir => {
    const pkg = JSON.parse(readFileSync(join(pkgsDir, dir, 'package.json'), 'utf8'));
    return { dir, name: pkg.name, version: pkg.version };
  })
  .filter(p => p.name && p.version && !coveredPackages.has(p.name));

// ── 3. Détecter les packages modifiés depuis leur dernier tag publié ──
const changedPackages = [];

for (const pkg of allPackages) {
  const tag = `${pkg.name}@${pkg.version}`;
  const refTag = `refs/tags/${tag}`;

  try {
    // Vérifie que le tag existe
    execSync(`git rev-parse "${refTag}"`, { stdio: 'pipe' });

    // Cherche des changements depuis ce tag dans le dossier du package
    const diff = execSync(
      `git diff --name-only "${refTag}" HEAD -- "packages/${pkg.dir}/"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (diff) {
      console.log(`📦 ${pkg.name}@${pkg.version} — changements détectés`);
      changedPackages.push(pkg);
    }
  } catch {
    // Tag introuvable → package jamais publié ou tag manquant
    console.log(`📦 ${pkg.name} — tag "${tag}" introuvable, ajout au bump`);
    changedPackages.push(pkg);
  }
}

if (changedPackages.length === 0) {
  console.log('✅ Tous les packages sont à jour, aucun changeset nécessaire.');
  process.exit(0);
}

// ── 4. Créer un patch changeset pour les packages modifiés ──
const id = randomBytes(4).toString('hex');
const frontmatter = changedPackages.map(p => `"${p.name}": patch`).join('\n');
const content = `---\n${frontmatter}\n---\n\nchore: update packages\n`;

writeFileSync(join(csDir, `auto-${id}.md`), content);

console.log(`\n✅ Changeset créé : auto-${id}.md (${changedPackages.length} package(s))`);
changedPackages.forEach(p => console.log(`   - ${p.name}`));
