#!/usr/bin/env node
// SOURCING: none. SPEC-COMMONPLACE-CHAT-SHELL-1.2 follow-up: Paper's
// getShaderColorFromString rejects CSS variables and silently falls back to
// mid-grey. Fail CI when a shaders-react color prop is fed `var(--...)`.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(appRoot, 'src');

const SHADER_IMPORT_RE =
  /from\s+['"]@paper-design\/shaders-react['"]|from\s+['"]@paper-design\/shaders['"]/;
// String or array color props known to Paper shader components.
const COLOR_PROP_RE =
  /\b(?:colorBack|colorFront|colorStroke)\s*=\s*(?:\{?\s*)?(?:`[^`]*`|'[^']*'|"[^"]*")|\bcolors\s*=\s*\{\s*\[[\s\S]*?\]\s*\}/g;
const VAR_IN_STRING_RE = /var\s*\(/i;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) yield full;
  }
}

const violations = [];

for (const file of walk(srcRoot)) {
  const text = readFileSync(file, 'utf8');
  if (!SHADER_IMPORT_RE.test(text)) continue;
  COLOR_PROP_RE.lastIndex = 0;
  let match;
  while ((match = COLOR_PROP_RE.exec(text)) !== null) {
    if (VAR_IN_STRING_RE.test(match[0])) {
      const line = text.slice(0, match.index).split('\n').length;
      violations.push({
        file: path.relative(appRoot, file),
        line,
        sample: match[0].replace(/\s+/g, ' ').slice(0, 120),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    'Paper shader color props must be concrete #/rgb/hsl strings, not CSS variables:',
  );
  for (const item of violations) {
    console.error(`  ${item.file}:${item.line} ${item.sample}`);
  }
  process.exit(1);
}

console.log('Paper shader color-prop gate: clean.');
