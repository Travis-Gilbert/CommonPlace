#!/usr/bin/env node
// SOURCING: @travis-gilbert/markdown-theory tokens (wcagContrast). The gate
// runs markdown-theory's WCAG solving over the pinned Int UI pairs so the
// pinned register inherits the computed register's guarantee without being
// derived (PLAN-GREENFIELD-ALIGNMENT section 4, HANDOFF-GREENFIELD-CONSOLE G2).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wcagContrast } from '@travis-gilbert/markdown-theory/tokens';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// hex -> linear sRGB -> OKLab -> OKLCH, so markdown-theory's Oklch-typed
// wcagContrast does the solving. The conversion constants are the published
// OKLab matrices (Bjorn Ottosson), not invented values.
function hexToOklch(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(l);
  const m3 = Math.cbrt(m);
  const s3 = Math.cbrt(s);
  const L = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
  const A = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const B = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: L, c: C, h: H };
}

// Resolve a --ij-* chain (token -> token -> hex) from the register stylesheets.
const registerCss = ['src/styles/int-ui-register.css', 'src/styles/register-bridge.css']
  .map((rel) => readFileSync(path.join(appRoot, rel), 'utf8'))
  .join('\n')
  // Strip block comments so prose mentioning tokens never shadows declarations.
  .replace(/\/\*[\s\S]*?\*\//g, '');

function resolveToken(name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`token cycle at ${name}`);
  seen.add(name);
  // Last declaration wins, matching the cascade (bridge overrides register).
  const declarations = [...registerCss.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, 'g'))];
  if (declarations.length === 0) throw new Error(`token ${name} not found in register files`);
  const value = declarations[declarations.length - 1][1].trim();
  const varMatch = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (varMatch) return resolveToken(varMatch[1], seen);
  const hexMatch = value.match(/^#[0-9a-fA-F]{6}$/);
  if (hexMatch) return value;
  throw new Error(`token ${name} resolves to non-hex value: ${value}`);
}

// The pinned pairs (G2), with per-role targets from markdown-theory's role
// model: primary ink and the learned gold read as text (4.5); secondary info
// is apparatus (ink3 role, 3.0); the accent slot is a UI component color (3.0).
const PAIRS = [
  { name: 'ink on chrome', fg: '--ij-ink', bg: '--ij-chrome', target: 4.5 },
  { name: 'info on chrome', fg: '--ij-ink-info', bg: '--ij-chrome', target: 3.0 },
  { name: 'gold on chrome', fg: '--ij-gold', bg: '--ij-chrome', target: 4.5 },
  { name: 'accent on chrome', fg: '--ij-accent', bg: '--ij-chrome', target: 3.0 },
  { name: 'ink on editor', fg: '--ij-ink', bg: '--ij-editor', target: 4.5 },
  { name: 'bright ink on accent', fg: '--ij-ink-bright', bg: '--ij-accent', target: 3.0 },
];

let failed = false;
for (const pair of PAIRS) {
  const fg = resolveToken(pair.fg);
  const bg = resolveToken(pair.bg);
  const ratio = wcagContrast(hexToOklch(fg), hexToOklch(bg));
  const ok = ratio >= pair.target;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${pair.name}: ${fg} on ${bg} = ${ratio.toFixed(2)} (target ${pair.target})`,
  );
}

if (failed) {
  console.error('Contrast gate: FAILED. The failing pair(s) are named above.');
  process.exit(1);
}
console.log('Contrast gate: all pinned pairs pass.');
