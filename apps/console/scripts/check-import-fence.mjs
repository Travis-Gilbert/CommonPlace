#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies.
// The import fence CI gate (HANDOFF-GREENFIELD-CONSOLE G1, named choice 11):
// apps/console cannot import from apps/web, @commonplace/web, or any relative
// path escaping apps/console except into packages/*. The eslint rule catches
// this in the editor; this script makes it a structural CI failure.

import { readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const srcRoot = path.join(appRoot, 'src');

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|mts|cts|js|jsx|mjs|css)$/.test(entry)) yield full;
  }
}

function scan() {
  const found = [];
  for (const file of walk(srcRoot)) {
    const text = readFileSync(file, 'utf8');
    const specifiers = [];
    let match;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(text)) !== null) {
      specifiers.push(match[1] ?? match[2] ?? match[3]);
    }
    if (file.endsWith('.css')) {
      for (const cssImport of text.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
        specifiers.push(cssImport[1]);
      }
    }
    for (const spec of specifiers) {
      if (!spec) continue;
      if (spec === '@commonplace/web' || spec.startsWith('@commonplace/web/')) {
        found.push({ file, spec, reason: 'depends on @commonplace/web' });
        continue;
      }
      if (spec.includes('apps/web')) {
        found.push({ file, spec, reason: 'reaches into apps/web' });
        continue;
      }
      if (spec.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), spec);
        const insideApp = resolved.startsWith(appRoot + path.sep);
        const insidePackages = resolved.startsWith(path.join(repoRoot, 'packages') + path.sep);
        if (!insideApp && !insidePackages) {
          found.push({ file, spec, reason: 'relative import escapes apps/console' });
        }
      }
    }
  }
  return found;
}

function report(found) {
  if (found.length > 0) {
    console.error('Import fence violations:');
    for (const violation of found) {
      console.error(`  ${path.relative(repoRoot, violation.file)}: "${violation.spec}" (${violation.reason})`);
    }
    process.exit(1);
  }
  console.log('Import fence: clean.');
}

// --self-test: prove the fence fires. Drops a probe importing apps/web into
// src, asserts the scan flags it, removes the probe (the G1 acceptance made
// mechanical so CI demonstrates the failure on every run).
if (process.argv.includes('--self-test')) {
  const probePath = path.join(srcRoot, '__fence-probe__.ts');
  writeFileSync(
    probePath,
    "import { anything } from '../../web/src/lib/block-view/types';\nexport const probe = anything;\n",
  );
  let flagged = 0;
  try {
    flagged = scan().length;
  } finally {
    rmSync(probePath, { force: true });
  }
  if (flagged === 0) {
    console.error('Fence self-test FAILED: the probe import was not flagged.');
    process.exit(1);
  }
  console.log('Fence self-test: probe import correctly flagged.');
}

report(scan());
