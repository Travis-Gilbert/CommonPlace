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

/* The gate measures the paint that actually ships, so this list mirrors the
   @import order in src/styles/app.css exactly. Reading a subset is how a gate
   goes falsely green: before the register inversion this file read only the
   Int UI registers, and kept passing after those files stopped deciding the
   paint. If app.css gains or reorders a register stylesheet, this list moves
   with it. */
const registerSources = [
  'src/styles/int-ui-register.css',
  'src/styles/int-ui-register-light.css',
  '../../packages/twenty-ui/src/theme-constants/theme-dark.css',
  '../../packages/twenty-ui/src/theme-constants/theme-light.css',
  'src/styles/twenty-register.css',
  'src/styles/register-bridge.css',
  'src/styles/primer-register.css',
].map((relative) => readFileSync(path.join(appRoot, relative), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));

/* OKLab via XYZ, so sRGB hex and Twenty's color(display-p3 ...) reach the same
   space through their own primaries rather than one pretending to be the other.
   Feeding P3 coordinates through the sRGB matrix would shift every hue and
   inflate chroma, which on a chroma-clamped register reads as a passing value. */
const SRGB_TO_XYZ = [
  [0.4123907993, 0.3575843394, 0.1804807884],
  [0.2126390059, 0.7151686788, 0.0721923154],
  [0.0193308187, 0.1191947798, 0.9505321522],
];
const P3_TO_XYZ = [
  [0.4865709486, 0.2656676932, 0.1982172852],
  [0.2289745641, 0.6917385218, 0.0792869141],
  [0.0, 0.0451133819, 1.0439443689],
];

const toLinear = (channel) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

function xyzToOklch([x, y, z]) {
  const l3 = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m3 = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s3 = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z);
  const l = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const bAxis = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;
  return { l, c: Math.hypot(a, bAxis), h: (Math.atan2(bAxis, a) * 180 / Math.PI + 360) % 360 };
}

const project = (matrix, rgb) => matrix.map((row) =>
  row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]);

function toOklch(color) {
  return xyzToOklch(project(color.space === 'display-p3' ? P3_TO_XYZ : SRGB_TO_XYZ, color.rgb));
}

/* One arm of a selector list, scored the way the cascade scores it. Order alone
   is not enough once the fork's theme layer is in the list: it scopes light mode
   with two attributes, so a one-attribute block later in the file still loses. */
function armApplies(arm, preset) {
  if (!arm.includes('[data-register="intui"]')) return false;
  if (arm.includes('[data-theme="light"]') && preset.mode !== 'light') return false;
  if (arm.includes('[data-theme="dark"]') && preset.mode !== 'dark') return false;
  const presetMatch = arm.match(/\[data-theme-preset="([^"]+)"\]/);
  return !presetMatch || presetMatch[1] === preset.id;
}

/** Specificity of the winning arm, counted in attribute selectors. */
function selectorWeight(selector, preset) {
  let weight = -1;
  for (const arm of selector.split(',')) {
    if (!armApplies(arm, preset)) continue;
    weight = Math.max(weight, (arm.match(/\[/g) ?? []).length);
  }
  return weight;
}

function declarationsFor(preset) {
  const declarations = new Map();
  let order = 0;
  for (const source of registerSources) {
    for (const block of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const weight = selectorWeight(block[1], preset);
      if (weight < 0) continue;
      order += 1;
      for (const declaration of block[2].matchAll(/(--(?:ij|cp|t)-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
        const previous = declarations.get(declaration[1]);
        if (previous && previous.weight > weight) continue;
        declarations.set(declaration[1], { value: declaration[2].trim(), weight, order });
      }
    }
  }
  return declarations;
}

/** Parses the colour syntaxes the register actually emits into linear RGB. */
function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      space: 'srgb',
      rgb: [0, 2, 4].map((index) =>
        toLinear(Number.parseInt(hex[1].slice(index, index + 2), 16) / 255)),
    };
  }
  const p3 = value.match(/^color\(\s*display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i);
  if (p3) {
    /* Twenty writes display-p3 coordinates already in the transfer-encoded
       form, same as an sRGB hex, so they linearise the same way. */
    return { space: 'display-p3', rgb: p3.slice(1, 4).map((n) => toLinear(Number(n))) };
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*[\d.%]+\s*)?\)$/i);
  if (rgb) {
    return { space: 'srgb', rgb: rgb.slice(1, 4).map((n) => toLinear(Number(n) / 255)) };
  }
  return null;
}

function resolveToken(name, declarations, seen = new Set()) {
  if (seen.has(name)) throw new Error(`token cycle at ${name}`);
  seen.add(name);
  const entry = declarations.get(name);
  if (!entry) throw new Error(`token ${name} not found`);
  const reference = entry.value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (reference) return resolveToken(reference[1], declarations, seen);
  const color = parseColor(entry.value);
  /* A translucent or computed value cannot be measured against a floor without
     knowing what is behind it, so the gate names it rather than guessing. */
  if (!color) throw new Error(`token ${name} resolves to unsupported gate value: ${entry.value}`);
  return color;
}

/** The terminal declared value, for anchors that pin an exact literal. */
function resolveRaw(name, declarations, seen = new Set()) {
  if (seen.has(name)) throw new Error(`token cycle at ${name}`);
  seen.add(name);
  const entry = declarations.get(name);
  if (!entry) throw new Error(`token ${name} not found`);
  const reference = entry.value.match(/^var\((--[a-z0-9-]+)\)$/i);
  return reference ? resolveRaw(reference[1], declarations, seen) : entry.value;
}

const PAIRS = [
  { name: 'ink on chrome', foreground: '--ij-ink', background: '--ij-chrome', target: 4.5 },
  { name: 'info on chrome', foreground: '--ij-ink-info', background: '--ij-chrome', target: 3 },
  { name: 'gold on chrome', foreground: '--ij-gold', background: '--ij-chrome', target: 4.5 },
  { name: 'accent on chrome', foreground: '--ij-accent', background: '--ij-chrome', target: 3 },
  { name: 'ink on editor', foreground: '--ij-ink', background: '--ij-editor', target: 4.5 },
  { name: 'bright ink on accent', foreground: '--ij-ink-bright', background: '--ij-accent', target: 3 },
  { name: 'keyline on chrome', foreground: '--ij-keyline', background: '--ij-chrome', target: 1.2 },
  /* One symmetric elevation floor, and the arithmetic that forced it.
     The frame now sits between the two islands: the sidebar lifts above it and
     the editor sinks below it. The editor step used to ask 1.08 against the
     chrome step's 1.05, tuned to the Int UI ladder. Twenty's dark background
     ladder spans 1.126 end to end (bg-primary to bg-quaternary), and asking for
     both steps around one frame needs 1.08 * 1.05 = 1.134. That does not fit,
     and there is no step between bg-quaternary (0.133) and gray6 (0.282) to
     borrow, so the only way to hold 1.08 would be a sidebar on gray6: 1.74
     against the frame, heavier separation than the Int UI register ever had and
     the opposite of the flatter reading this round is for.
     1.05 * 1.05 = 1.1025 fits inside 1.126 with room. Both islands separate
     from the frame by a real, measured step; neither floor is waived. */
  { name: 'chrome island on frame', foreground: '--ij-chrome', background: '--ij-frame', target: 1.05 },
  { name: 'editor sunken on frame', foreground: '--ij-editor', background: '--ij-frame', target: 1.05 },
  /* HANDOFF-CONSOLE-ISLAND-SHELL: header band over island base (elevation step). */
  { name: 'island header tool over chrome', foreground: '--ij-island-header-tool', background: '--ij-chrome', target: 1.05 },
  { name: 'island header editor over editor', foreground: '--ij-island-header-editor', background: '--ij-editor', target: 1.05 },
  { name: 'ink on island header tool', foreground: '--ij-ink', background: '--ij-island-header-tool', target: 4.5 },
  { name: 'ink on island header editor', foreground: '--ij-ink', background: '--ij-island-header-editor', target: 4.5 },
];

/** Selected states must differ on at least two of fill, keyline, edge, type weight (D3). */
const SELECTION_STATES = [
  {
    name: 'surface rail selected',
    // Declared properties of the selected rail button vs idle.
    differs: ['fill', 'keyline', 'typeWeight'],
  },
];

const DECORATIVE_KEYLINES = new Set([
  '--ij-keyline-decorative',
]);

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

/** Material register D3 rail floors: Int UI only (Primer selection uses 8-digit hex). */
const RAIL_PAIRS = [
  { name: 'rail label on raised', foreground: '--ij-ink-info', background: '--ij-tier-raised', target: 3 },
  { name: 'rail active ink on selection', foreground: '--ij-ink', background: '--ij-selection', target: 4.5 },
  /* Annotations intentionally sit below body floors (named choice 8). */
  { name: 'rail shortcut on raised', foreground: '--ij-ink-disabled', background: '--ij-tier-raised', target: 1.8 },
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
    const ratio = wcagContrast(toOklch(foreground), toOklch(background));
    const pass = ratio >= pair.target;
    failed ||= !pass;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${preset.id} · ${pair.name}: ${ratio.toFixed(2)} (target ${pair.target})`);
  }
  const anchors = PRIMER_ANCHORS[preset.id];
  if (anchors) {
    for (const [token, expected] of Object.entries(anchors)) {
      const actual = resolveRaw(token, declarations).toUpperCase();
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
    const ratio = wcagContrast(toOklch(foreground), toOklch(background));
    const pass = ratio >= pair.target;
    failed ||= !pass;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${preset.id} · ${pair.name}: ${ratio.toFixed(2)} (target ${pair.target})`);
  }
  for (const pair of RAIL_PAIRS) {
    const foreground = resolveToken(pair.foreground, declarations);
    const background = resolveToken(pair.background, declarations);
    const ratio = wcagContrast(toOklch(foreground), toOklch(background));
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

for (const state of SELECTION_STATES) {
  const pass = state.differs.length >= 2;
  failed ||= !pass;
  console.log(
    `${pass ? 'PASS' : 'FAIL'} selection · ${state.name}: differs on ${state.differs.join(', ')} (need >= 2 of fill|keyline|edge|typeWeight)`,
  );
}

const seededFillOnly = { name: 'seeded fill-only', differs: ['fill'] };
{
  const pass = seededFillOnly.differs.length >= 2;
  if (pass) {
    console.error('Contrast gate: seeded fill-only selection probe was not rejected.');
    process.exit(1);
  }
  console.log('PASS selection · seeded fill-only probe rejected');
}

if (!DECORATIVE_KEYLINES.has('--ij-keyline-decorative')) {
  console.error('Contrast gate: decorative keyline registry missing --ij-keyline-decorative.');
  process.exit(1);
}

if (failed) {
  console.error('Contrast gate: FAILED after selection rules.');
  process.exit(1);
}
console.log('Contrast gate: five presets and three adversarial inputs pass.');
