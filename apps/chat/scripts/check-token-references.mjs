#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies.
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW3. Fails when the fork uses a design
// token it never defines.
//
// This exists because of a real bug, not a hypothetical one. OW3 removed
// --dls-accent-rgb and --dls-secondary-rgb, having found three call sites.
// There were thirteen. The other ten were written as
// `rgba(var(--dls-accent-rgb),0.14)` inside Tailwind arbitrary values, which
// the first grep pattern did not match, so focus rings and tickers across the
// app silently resolved to nothing. An undefined custom property does not
// error: the declaration is simply dropped, and the surface renders without it.
// Nothing in typecheck, build, or the existing gates notices.
//
// Scope is the families the fork owns. Third-party and Tailwind-generated
// properties are excluded because they are defined outside this source tree
// and a naive whole-file check drowns in them.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chatRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(chatRoot, 'src');

/** Token families this app is responsible for defining. */
const OWNED = /^--(dls|ij|cp|gy|ow)-/;

const USE = /var\(\s*(--[a-z0-9-]+)/gi;
const DEFINE = /(--[a-z0-9-]+)\s*:/g;

function* sourceFiles(directory) {
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (/\.(css|tsx?|jsx?)$/.test(entry)) yield full;
  }
}

const defined = new Set();
const used = new Map();

for (const file of sourceFiles(sourceRoot)) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(DEFINE)) {
    if (OWNED.test(match[1])) defined.add(match[1]);
  }
  for (const match of text.matchAll(USE)) {
    const name = match[1];
    if (!OWNED.test(name)) continue;
    if (!used.has(name)) used.set(name, path.relative(chatRoot, file));
  }
}

const dangling = [...used.entries()].filter(([name]) => !defined.has(name));

if (dangling.length === 0) {
  console.log(`Token references: ${used.size} owned tokens used, all defined.`);
  process.exit(0);
}

console.error(`Token references: ${dangling.length} used but never defined.`);
for (const [name, file] of dangling) console.error(`  ${name}  first seen in ${file}`);
console.error('An undefined custom property is dropped silently, so the surface');
console.error('renders without it. Define it in a register, or replace the use.');
process.exit(1);
