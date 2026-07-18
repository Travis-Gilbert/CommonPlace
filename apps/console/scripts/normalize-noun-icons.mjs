#!/usr/bin/env node
// Normalizes downloaded Noun Project SVG paint to currentColor. This is the
// one SVG ingress directory; React ports copy geometry from these sources.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconRoot = path.join(appRoot, 'src', 'assets', 'icons', 'noun');

for (const entry of readdirSync(iconRoot).filter((name) => name.endsWith('.svg'))) {
  const file = path.join(iconRoot, entry);
  const source = readFileSync(file, 'utf8');
  const normalized = source
    .replace(/\s(?:width|height)\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s(fill|stroke)\s*=\s*["'](?!none\b|currentColor\b)[^"']*["']/gi, ' $1="currentColor"')
    .replace(/>\s+</g, '><')
    .trim();
  writeFileSync(file, `${normalized}\n`);
  console.log(`normalized ${path.relative(appRoot, file)}`);
}
