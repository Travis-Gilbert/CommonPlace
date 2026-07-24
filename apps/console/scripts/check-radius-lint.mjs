#!/usr/bin/env node
// SOURCING: none. Radius scale lint for SPEC-MATERIAL-REGISTER-1.0 D2.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(appRoot, 'src');

const ALLOWED = [
  path.join(srcRoot, 'styles'),
  path.join(srcRoot, 'motion'),
];

function isAllowed(file) {
  return ALLOWED.some((prefix) => file === prefix || file.startsWith(prefix + path.sep));
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (/\.(tsx|ts|css)$/.test(entry)) yield full;
  }
}

const RAW_RADIUS = /(?:border-radius|rounded(?:-[a-z]+)?)\s*[:=]\s*[^;\n]*\b\d+(?:\.\d+)?px\b/;
const SCALE_TOKEN = /var\(--ij-radius-(?:xs|sm|md|lg|xl)\)|var\(--ij-arc(?:-underline)?\)|rounded-ij-/;

const violations = [];

for (const file of walk(srcRoot)) {
  if (isAllowed(file)) continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (!RAW_RADIUS.test(line)) return;
    if (SCALE_TOKEN.test(line)) return;
    violations.push({
      file,
      line: index + 1,
      sample: line.trim().slice(0, 100),
    });
  });
}

// Seeded self-check: a raw radius outside the register must be caught.
const probe = 'border-radius: 99px;';
if (!RAW_RADIUS.test(probe) || SCALE_TOKEN.test(probe)) {
  console.error('Radius lint: seeded raw-radius probe was not caught.');
  process.exit(1);
}

if (violations.length > 0) {
  console.error('Radius lint violations (use --ij-radius-* / --ij-arc / rounded-ij-*):');
  for (const violation of violations) {
    console.error(`  ${path.relative(appRoot, violation.file)}:${violation.line} ${violation.sample}`);
  }
  process.exit(1);
}

console.log('Radius lint: clean (seeded raw-radius probe caught).');
