#!/usr/bin/env node
// The icon paint gate. The inline hostile probe proves the matcher fails a
// hard-coded SVG before the real canonical directory is scanned.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARDCODED_PAINT = [
  /\b(?:fill|stroke)\s*=\s*["'](?!none["']|currentColor["'])[^"']+["']/gi,
  /\b(?:fill|stroke)\s*=\s*\{\s*["'](?!none["']|currentColor["'])[^"']+["']\s*\}/gi,
  /\b(?:fill|stroke)\s*:\s*["'](?!none["']|currentColor["'])[^"']+["']/gi,
];

export function hardcodedPaint(source) {
  return HARDCODED_PAINT.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[0]));
}

const hostileProbes = [
  '<svg><path fill="#ff0000" /></svg>',
  "<path fill={'#f00'} />",
  "<path style={{ fill: '#f00' }} />",
];
if (hostileProbes.some((probe) => hardcodedPaint(probe).length !== 1)) {
  throw new Error('icon gate probe failed to catch a hard-coded paint form');
}

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconRoot = path.join(appRoot, 'src', 'assets', 'icons', 'noun');
const failures = [];
const iconSource = path.join(appRoot, 'src', 'components', 'shell', 'icons.tsx');
const files = [
  ...readdirSync(iconRoot).filter((name) => name.endsWith('.svg')).map((name) => path.join(iconRoot, name)),
  iconSource,
];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const matches = hardcodedPaint(source);
  if (matches.length) failures.push(`${path.relative(appRoot, file)}: ${matches.join(', ')}`);
  if (file.endsWith('.svg')) {
    const root = source.match(/<svg\b[^>]*>/i)?.[0] ?? '';
    if (!/\b(?:fill|stroke)=["']currentColor["']/i.test(root)) {
      failures.push(`${path.relative(appRoot, file)}: root must inherit currentColor paint`);
    }
  }
}

const assetNames = readdirSync(iconRoot).filter((name) => name.endsWith('.svg'));
const referencedIds = [...readFileSync(iconSource, 'utf8').matchAll(/noun(?:-[a-z]+)*-(\d{6,})/gi)]
  .map((match) => match[1]);
for (const id of new Set(referencedIds)) {
  if (!assetNames.some((name) => name.includes(id))) failures.push(`missing canonical Noun SVG for icon ${id}`);
}

if (failures.length) {
  console.error(`Noun icon paint gate failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('Noun icon paint gate: hostile probe caught; canonical SVGs and React ports use currentColor.');
