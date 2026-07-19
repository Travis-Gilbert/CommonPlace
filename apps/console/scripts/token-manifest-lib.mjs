// SOURCING: none. Pure logic, no upstream component applies.
// The token manifest (HANDOFF-CONSOLE-DIMENSIONALITY X2, named choice 2).
//
// The register lint checks the FORM of a value (is it a variable) but not its
// PROVENANCE (does it belong to the system). That is the hole the 21st source's
// decoration went through: it was laundered into a parallel --ij-composer-*
// family, every value a var(), and it passed CI. Components may not mint
// register tokens. Every --ij-*, --rec-* and --gy-* name lives in a register
// file with a provenance line, and the manifest makes adding one a reviewed
// diff rather than a silent import of somebody else's design language.
//
// This module is the shared half: the generator writes the manifest from it and
// the checker re-derives and compares, so the two can never disagree.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const srcRoot = path.join(appRoot, 'src');
export const MANIFEST_PATH = path.join(srcRoot, 'styles', 'token-manifest.json');

/**
 * The register files, and where each one's values come from. This map IS the
 * provenance: a JetBrains source path, a Twenty values doc, a speaker spec, or
 * a ledger row. A register file with no entry here cannot define tokens, which
 * is what stops a component stylesheet from quietly becoming a register.
 */
export const REGISTER_PROVENANCE = {
  'src/styles/int-ui-register.css':
    'JetBrains/intellij-community platform/platform-resources/src/themes/expUI/expUI_dark.theme.json (SHA 1a82cda), verbatim Int UI Dark values',
  'src/styles/int-ui-register-light.css':
    'JetBrains/intellij-community platform/platform-resources/src/themes/expUI/expUI_light.theme.json (commit 0db751c0, SHA-256 411be97a), verbatim Int UI Light values',
  'src/styles/primer-register.css':
    'GitHub Primer primitives, the second coloration register offered by the appearance surface',
  'src/styles/rec-structural.css':
    'TWENTY-APP-VALUES, read from twentyhq/twenty packages/twenty-ui/src/theme/constants (2026-07-17); structure only, never material',
  'src/styles/register-bridge.css':
    'Derived slots: Tailwind v4 aliases over register tokens, the contrast-gate resolutions, the composer and tool window metrics, and the AMENDMENT-REGISTERS speaker vocabulary',
  'src/styles/gy-bridge.css':
    'Galley (@travis-gilbert/markdown-theory) document register, bridged onto the console register',
  'src/styles/galley-register.css':
    'Generated from the Galley package by scripts/generate-galley-register.mjs',
  'src/styles/theme-engine.ts':
    'The runtime derivation engine: the appearance surface computes these slots from user knobs, clamped by the contrast gate',
};

export const TOKEN_RE = /--(?:ij|rec|gy)-[a-z0-9-]+/;
const DEFINITION_RE = /^\s*(--(?:ij|rec|gy)-[a-z0-9-]+)\s*:/;
const INLINE_DEFINITION_RE = /(--(?:ij|rec|gy)-[a-z0-9-]+)\s*:/g;

export function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|css)$/.test(entry)) yield full;
  }
}

/** The nearest preceding comment line, which is the per-token note. Register
 *  files annotate in both shapes: a trailing comment on the declaration line
 *  and a block above a group of them. */
function noteFor(lines, index) {
  const trailing = lines[index].match(/\/\*\s*(.+?)\s*\*\//);
  if (trailing) return trailing[1];
  // Walk back to the OPENING of the nearest preceding block comment and take
  // its first line. Reading backwards line by line instead lands on the `*/`
  // terminator and captures the slash, which is a note about nothing.
  for (let cursor = index - 1; cursor >= 0 && cursor >= index - 24; cursor -= 1) {
    const line = lines[cursor];
    if (line.trim() === '' || line.trim() === '}') return null;
    if (DEFINITION_RE.test(line)) continue;
    const opening = line.match(/\/\*+\s*(.*)$/);
    if (opening) {
      const first = opening[1].replace(/\s*\*\/\s*$/, '').trim();
      // A block that opens with nothing on the first line carries its text on
      // the next one.
      return first || (lines[cursor + 1] ?? '').replace(/^\s*\*?\s*/, '').replace(/\s*\*\/\s*$/, '').trim() || null;
    }
  }
  return null;
}

/** Every token a register file defines, in source order. */
function tokensIn(relative) {
  const text = readFileSync(path.join(appRoot, relative), 'utf8');
  const lines = text.split('\n');
  const found = [];
  lines.forEach((line, index) => {
    // Several register lines pack multiple declarations (the palette ramps).
    INLINE_DEFINITION_RE.lastIndex = 0;
    for (const match of line.matchAll(INLINE_DEFINITION_RE)) {
      found.push({ token: match[1], note: noteFor(lines, index) });
    }
  });
  return found;
}

/** theme-engine.ts declares the slots it derives as a string array rather than
 *  as CSS declarations, so it is read through its own DERIVED list. */
function tokensInThemeEngine(relative) {
  const text = readFileSync(path.join(appRoot, relative), 'utf8');
  const found = new Set();
  for (const match of text.matchAll(/'(--(?:ij|rec|gy)-[a-z0-9-]+)'/g)) found.add(match[1]);
  // The gray ramp is generated by index, not written literally.
  if (/--ij-gray-\$\{index \+ 1\}/.test(text)) {
    for (let index = 1; index <= 14; index += 1) found.add(`--ij-gray-${index}`);
  }
  return [...found].map((token) => ({ token, note: 'derived at runtime from appearance knobs' }));
}

/** The manifest: every register token, the file that owns it, and why that
 *  file is allowed to own it. Sorted so the checked-in file is a stable diff. */
export function buildManifest() {
  const entries = new Map();
  for (const relative of Object.keys(REGISTER_PROVENANCE)) {
    const found = relative.endsWith('.ts') ? tokensInThemeEngine(relative) : tokensIn(relative);
    for (const { token, note } of found) {
      // First definition wins; later files re-resolve the same slot per theme
      // (the light register and the bridge overrides are re-resolutions, not
      // new names) and are recorded as such.
      const existing = entries.get(token);
      if (existing) {
        if (!existing.resolvedAlsoIn.includes(relative)) existing.resolvedAlsoIn.push(relative);
        continue;
      }
      entries.set(token, {
        file: relative,
        provenance: REGISTER_PROVENANCE[relative],
        note: note ?? null,
        resolvedAlsoIn: [],
      });
    }
  }
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

/** A quoted register-token name in TS/TSX. Components define custom properties
 *  through quoted keys (`{'--ij-x': v}`, `['--ij-x' as string]: v`) and through
 *  setProperty, none of which look like a CSS declaration -- which is exactly
 *  how a laundered family would slip past a CSS-shaped scan. Every legitimate
 *  quoted use in this tree is a READ through getPropertyValue, so a quoted
 *  token that is not being read is being minted. */
const QUOTED_TOKEN_RE = /(['"`])(--(?:ij|rec|gy)-[a-z0-9-]+)\1/g;

/** Token DEFINITIONS outside the register files. A component minting
 *  --ij-anything lands here, which is the mechanism named choice 2 asks for. */
export function mintedOutsideRegisters() {
  const registers = new Set(Object.keys(REGISTER_PROVENANCE).map((relative) => path.join(appRoot, relative)));
  const offenders = [];
  for (const file of walk(srcRoot)) {
    if (registers.has(file)) continue;
    if (/\.test\.tsx?$/.test(file)) continue;
    const isScript = /\.tsx?$/.test(file);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const at = { file: path.relative(appRoot, file), line: index + 1 };
      // A definition, not a reference: `--ij-x: value`, never `var(--ij-x)`.
      const stripped = line.replace(/var\(\s*--[a-z0-9-]+\s*(?:,[^)]*)?\)/g, '');
      for (const match of stripped.matchAll(INLINE_DEFINITION_RE)) {
        offenders.push({ ...at, token: match[1] });
      }
      if (!isScript) return;
      for (const match of line.matchAll(QUOTED_TOKEN_RE)) {
        const before = line.slice(0, match.index ?? 0);
        if (/getPropertyValue\(\s*$/.test(before)) continue;
        offenders.push({ ...at, token: match[2] });
      }
    });
  }
  return offenders;
}

export function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}
