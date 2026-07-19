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

// The canvas half of gate 4 (HANDOFF-CONSOLE-DIMENSIONALITY, motion-gate
// reconciliation). Everything above is textual: it sees CSS animation
// declarations and literal durations. A canvas that obtains a rendering context
// and drives its own requestAnimationFrame loop declares none of those, so it
// passed the scan while animating -- the exact defect rule 4 forbids, invisible
// to the mechanism meant to catch it. A painting surface must therefore be
// named on DECLARED_PAINT_SURFACES in the motion register.
//
// The pairing (getContext AND requestAnimationFrame in one file) is what makes
// this precise: rAF alone is also how focus restoration is scheduled all over
// the app, and none of those calls paint anything.
const PAINT_CONTEXT_RE = /\.getContext\(\s*['"](?:2d|webgl2?|bitmaprenderer)['"]/;
const RAF_RE = /\brequestAnimationFrame\s*\(/;

function declaredSurfaces() {
  const source = readFileSync(path.join(srcRoot, 'motion', 'motion-tokens.ts'), 'utf8');
  const block = source.match(/DECLARED_PAINT_SURFACES\s*=\s*\[([\s\S]*?)\n\] as const;/);
  if (!block) {
    console.error('Motion inventory scan: DECLARED_PAINT_SURFACES is missing from the motion register.');
    process.exit(1);
  }
  return new Set([...block[1].matchAll(/file:\s*'([^']+)'/g)].map((match) => match[1]));
}

function paintsInAFrameLoop(text) {
  return PAINT_CONTEXT_RE.test(text) && RAF_RE.test(text);
}

function scanPaintSurfaces(declared) {
  const undeclared = [];
  for (const file of walk(srcRoot)) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    const relative = path.relative(appRoot, file);
    if (declared.has(relative)) continue;
    if (paintsInAFrameLoop(readFileSync(file, 'utf8'))) undeclared.push(relative);
  }
  return undeclared;
}

const declared = declaredSurfaces();

// Hostile probe (the icon gate's pattern): prove the scan actually fires rather
// than passing because it detects nothing. A synthetic undeclared painter must
// be caught, or the gate is decorative.
const probe = "const c = ref.getContext('2d'); requestAnimationFrame(draw);";
if (!paintsInAFrameLoop(probe)) {
  console.error('Motion inventory scan: the undeclared-painter probe was NOT caught; the canvas scan is inert.');
  process.exit(1);
}

for (const file of scanPaintSurfaces(declared)) {
  violations.push({
    file: path.join(appRoot, file),
    line: 1,
    name: 'undeclared canvas paint loop',
    sample: 'add it to DECLARED_PAINT_SURFACES with its INTERACTION_INVENTORY row',
  });
}

// A declared surface that stopped painting is stale provenance, not a defect to
// ignore: the list must describe the tree it governs.
for (const relative of declared) {
  const full = path.join(appRoot, relative);
  let text;
  try {
    text = readFileSync(full, 'utf8');
  } catch {
    violations.push({ file: full, line: 1, name: 'declared paint surface does not exist', sample: relative });
    continue;
  }
  // Staleness is judged on the paint context alone, not the strict pairing: a
  // declared surface may hand its frame loop to a library (PresenceMark drives
  // textmode.js at a set frameRate rather than calling rAF itself) and is still
  // a canvas painting surface this list must govern.
  if (!PAINT_CONTEXT_RE.test(text)) {
    violations.push({
      file: full,
      line: 1,
      name: 'declared paint surface no longer paints to a canvas',
      sample: 'remove it from DECLARED_PAINT_SURFACES',
    });
  }
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

console.log(
  `Motion inventory scan: clean (${declared.size} declared paint surfaces; undeclared-painter probe caught).`,
);
