#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies.
// The register lint (HANDOFF-GREENFIELD-CONSOLE G2): the CR1 lint retargeted
// to --ij-* and --rec-*. No raw color, no arbitrary-value Tailwind class, no
// raw palette utility, no *.module.css anywhere outside the register files.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(appRoot, 'src');

// The register files themselves are the only place raw values live.
const REGISTER_FILES = new Set([
  path.join(srcRoot, 'styles', 'int-ui-register.css'),
  path.join(srcRoot, 'styles', 'int-ui-register-light.css'),
  path.join(srcRoot, 'styles', 'primer-register.css'),
  path.join(srcRoot, 'styles', 'theme-engine.ts'),
  path.join(srcRoot, 'styles', 'rec-structural.css'),
  path.join(srcRoot, 'styles', 'register-bridge.css'),
  path.join(srcRoot, 'styles', 'gy-bridge.css'),
  path.join(srcRoot, 'styles', 'galley-register.css'),
  path.join(srcRoot, 'styles', 'app.css'),
]);

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
// Tailwind arbitrary-value classes: utility-[...] carrying a raw value.
// Arbitrary VARIANTS (data-[...], aria-[...], group-data-[...]) are selector
// states, not values, and stay legal; the ban targets raw paint and metric
// values bypassing the register.
// A utility token at a string/whitespace boundary, not a data-/aria- variant,
// whose bracket carries a value-shaped payload (digit or hex). Boundary and
// payload requirements keep regex literals in code from false-positives.
const ARBITRARY_RE = /(?:^|[\s"'`])(?!data-|aria-|group-data-|peer-data-)[a-z][a-z0-9:-]*-\[[^\]\n]*[0-9#][^\]\n]*\]/g;
// Raw Tailwind palette utilities that would bypass the register.
const PALETTE_RE =
  /\b(?:bg|text|border|fill|stroke|ring|outline|decoration|accent|caret|divide|from|via|to|shadow)-(?:red|blue|green|yellow|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|gray|grey|slate|zinc|neutral|stone)-\d{2,3}\b/g;
const MODULE_CSS_RE = /\.module\.css/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|css|mjs)$/.test(entry)) yield full;
  }
}

const violations = [];

for (const file of walk(srcRoot)) {
  if (REGISTER_FILES.has(file)) continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const [name, re] of [
      ['hex literal', HEX_RE],
      ['arbitrary-value class', ARBITRARY_RE],
      ['raw palette utility', PALETTE_RE],
      ['module.css', MODULE_CSS_RE],
    ]) {
      re.lastIndex = 0;
      const match = re.exec(line);
      if (match) {
        violations.push({ file, line: index + 1, name, sample: match[0] });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('Register lint violations (raw values belong in register files only):');
  for (const violation of violations) {
    console.error(
      `  ${path.relative(appRoot, violation.file)}:${violation.line} ${violation.name}: ${violation.sample}`,
    );
  }
  process.exit(1);
}

console.log('Register lint: clean.');
