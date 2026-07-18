#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies.
// The motion inventory scan (HANDOFF-GREENFIELD-CONSOLE G4): chrome carries
// no ambient animation, every duration is a token, and animation properties
// exist only in the motion file and the register. Anything animating that is
// not on the interaction inventory is a defect; this scan enforces the
// mechanical half of that rule.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(appRoot, 'src');

// Files allowed to declare animation machinery: the motion register, the
// pinned Int UI register (its --ij-motion tokens), and the bridge.
const ALLOWED = [
  path.join(srcRoot, 'motion'),
  path.join(srcRoot, 'styles', 'int-ui-register.css'),
  path.join(srcRoot, 'styles', 'register-bridge.css'),
  path.join(srcRoot, 'styles', 'rec-structural.css'),
  path.join(srcRoot, 'styles', 'galley-register.css'),
];

function isAllowed(file) {
  return ALLOWED.some((prefix) => file === prefix || file.startsWith(prefix + path.sep));
}

// Literal durations (160ms, 0.1s) outside the token files; CSS animation and
// @keyframes declarations; transition declarations that do not resolve to a
// register or motion token var().
const DURATION_RE = /\b\d+(?:\.\d+)?m?s\b/;
const ANIMATION_RE = /\banimation(?:-[a-z]+)?\s*:|@keyframes\b/;
const TRANSITION_LITERAL_RE = /\btransition\s*:\s*(?!var\(--)[^;]*\d+(?:\.\d+)?m?s/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|css)$/.test(entry)) yield full;
  }
}

const violations = [];

for (const file of walk(srcRoot)) {
  if (isAllowed(file)) continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (ANIMATION_RE.test(line)) {
      violations.push({ file, line: index + 1, name: 'animation declaration outside motion register', sample: line.trim().slice(0, 80) });
      return;
    }
    if (TRANSITION_LITERAL_RE.test(line)) {
      violations.push({ file, line: index + 1, name: 'transition with literal duration', sample: line.trim().slice(0, 80) });
      return;
    }
    // Duration literals in TS/TSX (motion props, timeouts used as animation
    // timing). CSS custom property *references* are fine; literals are not.
    if (/\.(ts|tsx)$/.test(file) && /duration|delay|transition/i.test(line) && DURATION_RE.test(line)) {
      violations.push({ file, line: index + 1, name: 'duration literal outside motion-tokens.ts', sample: line.trim().slice(0, 80) });
    }
  });
}

if (violations.length > 0) {
  console.error('Motion inventory scan violations:');
  for (const violation of violations) {
    console.error(
      `  ${path.relative(appRoot, violation.file)}:${violation.line} ${violation.name}: ${violation.sample}`,
    );
  }
  process.exit(1);
}

console.log('Motion inventory scan: clean.');
