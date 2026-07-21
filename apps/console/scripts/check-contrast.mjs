#!/usr/bin/env node
// SOURCING: @travis-gilbert/markdown-theory tokens (wcagContrast). This gate
// evaluates the real CSS cascade for all four stock presets, then exercises
// the generated Navy preset and three adversarial knob inputs.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wcagContrast } from '@travis-gilbert/markdown-theory/tokens';
import { NAVY_KNOBS, generateTheme } from '../src/styles/theme-engine.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registerSources = [
  'src/styles/int-ui-register.css',
  'src/styles/int-ui-register-light.css',
  'src/styles/register-bridge.css',
  'src/styles/primer-register.css',
].map((relative) => readFileSync(path.join(appRoot, relative), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));

function hexToOklch(hex) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const linearL = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const linearM = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const linearS = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(linearL);
  const m3 = Math.cbrt(linearM);
  const s3 = Math.cbrt(linearS);
  const l = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const bAxis = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;
  return { l, c: Math.hypot(a, bAxis), h: (Math.atan2(bAxis, a) * 180 / Math.PI + 360) % 360 };
}

function selectorApplies(selector, preset) {
  if (!selector.includes('[data-register="intui"]')) return false;
  const lightOnly = selector.includes('[data-theme="light"]');
  const darkOnly = selector.includes('[data-theme="dark"]');
  if (lightOnly && preset.mode !== 'light') return false;
  if (darkOnly && preset.mode !== 'dark') return false;
  const presetMatch = selector.match(/\[data-theme-preset="([^"]+)"\]/);
  return !presetMatch || presetMatch[1] === preset.id;
}

function declarationsFor(preset) {
  const declarations = new Map();
  for (const source of registerSources) {
    for (const block of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!selectorApplies(block[1], preset)) continue;
      for (const declaration of block[2].matchAll(/(--(?:ij|cp)-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
        declarations.set(declaration[1], declaration[2].trim());
      }
    }
  }
  return declarations;
}

function resolveToken(name, declarations, seen = new Set()) {
  if (seen.has(name)) throw new Error(`token cycle at ${name}`);
  seen.add(name);
  const value = declarations.get(name);
  if (!value) throw new Error(`token ${name} not found`);
  const reference = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (reference) return resolveToken(reference[1], declarations, seen);
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  throw new Error(`token ${name} resolves to unsupported gate value: ${value}`);
}

const PAIRS = [
  { name: 'ink on chrome', foreground: '--ij-ink', background: '--ij-chrome', target: 4.5 },
  { name: 'info on chrome', foreground: '--ij-ink-info', background: '--ij-chrome', target: 3 },
  { name: 'gold on chrome', foreground: '--ij-gold', background: '--ij-chrome', target: 4.5 },
  { name: 'accent on chrome', foreground: '--ij-accent', background: '--ij-chrome', target: 3 },
  { name: 'ink on editor', foreground: '--ij-ink', background: '--ij-editor', target: 4.5 },
  { name: 'bright ink on accent', foreground: '--ij-ink-bright', background: '--ij-accent', target: 3 },
  /* HANDOFF-CONSOLE-BLOCK-SYSTEM choice 8: island surfaces vs frame floor. */
  { name: 'chrome island on frame', foreground: '--ij-chrome', background: '--ij-frame', target: 1.2 },
  { name: 'editor island on frame', foreground: '--ij-editor', background: '--ij-frame', target: 1.2 },
  /* HANDOFF-CONSOLE-ISLAND-SHELL: header band over island base (elevation step). */
  { name: 'island header tool over chrome', foreground: '--ij-island-header-tool', background: '--ij-chrome', target: 1.05 },
  { name: 'island header editor over editor', foreground: '--ij-island-header-editor', background: '--ij-editor', target: 1.05 },
  { name: 'ink on island header tool', foreground: '--ij-ink', background: '--ij-island-header-tool', target: 4.5 },
  { name: 'ink on island header editor', foreground: '--ij-ink', background: '--ij-island-header-editor', target: 4.5 },
];

// Speaker register (AMENDMENT-REGISTERS-AND-MOBILE-RECONCILIATION 2.5, D6): the
// --cp-* speaker colors are register level, not preset varying, so they are
// verified on the base Int UI register in both modes rather than across the
// Primer presets. Human ink and agent voice read as body text (4.5);
// destructive reads as a UI/large label (3); memory reuses the gold pair above.
const SPEAKER_PAIRS = [
  { name: 'human on chrome', foreground: '--cp-human', background: '--ij-chrome', target: 4.5 },
  { name: 'agent on chrome', foreground: '--cp-agent', background: '--ij-chrome', target: 4.5 },
  { name: 'human on editor', foreground: '--cp-human', background: '--ij-editor', target: 4.5 },
  { name: 'agent on editor', foreground: '--cp-agent', background: '--ij-editor', target: 4.5 },
  { name: 'destructive on chrome', foreground: '--cp-destructive', background: '--ij-chrome', target: 3 },
];

const PRIMER_ANCHORS = {
  'github-dark': {
    '--ij-editor': '#0D1117',
    '--ij-ink': '#F0F6FC',
    '--ij-control-border': '#3D444D',
    '--ij-accent': '#1F6FEB',
  },
  'github-light': {
    '--ij-editor': '#FFFFFF',
    '--ij-ink': '#1F2328',
    '--ij-control-border': '#D1D9E0',
    '--ij-accent': '#0969DA',
  },
};

let failed = false;
for (const preset of [
  { id: 'intellij-dark', mode: 'dark' },
  { id: 'intellij-light', mode: 'light' },
  { id: 'github-dark', mode: 'dark' },
  { id: 'github-light', mode: 'light' },
]) {
  const declarations = declarationsFor(preset);
  for (const pair of PAIRS) {
    const foreground = resolveToken(pair.foreground, declarations);
    const background = resolveToken(pair.background, declarations);
    const ratio = wcagContrast(hexToOklch(foreground), hexToOklch(background));
    const pass = ratio >= pair.target;
    failed ||= !pass;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${preset.id} · ${pair.name}: ${ratio.toFixed(2)} (target ${pair.target})`);
  }
  const anchors = PRIMER_ANCHORS[preset.id];
  if (anchors) {
    for (const [token, expected] of Object.entries(anchors)) {
      const actual = resolveToken(token, declarations).toUpperCase();
      const pass = actual === expected;
      failed ||= !pass;
      console.log(`${pass ? 'PASS' : 'FAIL'} ${preset.id} · Primer anchor ${token}: ${actual}`);
    }
  }
}

// Speaker pairs on the base register in both modes (SPEAKER_PAIRS above): dark
// values live in the base register block, light values in the light-theme scope.
for (const preset of [
  { id: 'intellij-dark', mode: 'dark' },
  { id: 'intellij-light', mode: 'light' },
]) {
  const declarations = declarationsFor(preset);
  for (const pair of SPEAKER_PAIRS) {
    const foreground = resolveToken(pair.foreground, declarations);
    const background = resolveToken(pair.background, declarations);
    const ratio = wcagContrast(hexToOklch(foreground), hexToOklch(background));
    const pass = ratio >= pair.target;
    failed ||= !pass;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${preset.id} · ${pair.name}: ${ratio.toFixed(2)} (target ${pair.target})`);
  }
}

for (const generated of [
  { name: 'navy', mode: 'dark', knobs: NAVY_KNOBS },
  { name: 'adversarial-high', mode: 'dark', knobs: { tintHue: 900, tintChroma: 1, highlightHue: -900 } },
  { name: 'adversarial-low', mode: 'light', knobs: { tintHue: -900, tintChroma: -1, highlightHue: 900 } },
  { name: 'adversarial-edge', mode: 'light', knobs: { tintHue: 84, tintChroma: 0.04, highlightHue: 84 } },
]) {
  const result = generateTheme(generated.mode, generated.knobs);
  for (const check of result.checks) {
    failed ||= !check.pass;
    console.log(`${check.pass ? 'PASS' : 'FAIL'} ${generated.name} · ${check.name}: ${check.ratio.toFixed(2)} (target ${check.target})`);
  }
}

if (failed) {
  console.error('Contrast gate: FAILED. The failing pair(s) are named above.');
  process.exit(1);
}
console.log('Contrast gate: five presets and three adversarial inputs pass.');
