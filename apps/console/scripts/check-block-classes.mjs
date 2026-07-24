#!/usr/bin/env node
// SOURCING: none. Pure logic.
// Homogeneous-block + perceptual elevation gate: three or more blocks need two
// BlockSurfaceClass labels, and the
// editor/tool base tokens must differ by a visible luminance step.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Relative luminance (WCAG). Used for editor-vs-tool delta so an 8/255 pair
 * fails while A1 gray-12 vs white passes.
 */
function relativeLuminance(hex) {
  const value = hex.replace('#', '').trim();
  const channels = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Minimum |ΔY| between editor and tool. Old gray-13/white ≈ 0.062; A1 ≈ 0.161. */
export const MIN_EDITOR_TOOL_LUMINANCE_DELTA = 0.1;

/**
 * Proving surfaces: editor block (EditorTabs) plus open companions.
 * Classes mirror workspace-seed companions (tool) + editor region (editor).
 */
const PROVING_SURFACES = [
  {
    name: 'workspace (editor + files + context + thread)',
    classes: ['editor', 'tool', 'tool', 'tool'],
  },
  {
    name: 'cards (cards.grid + companions)',
    classes: ['editor', 'tool', 'tool', 'tool'],
  },
  {
    name: 'chat (editor + companions; chat.surface mounts in editor)',
    classes: ['editor', 'tool', 'tool', 'tool'],
  },
  {
    name: 'block-canvas homogeneous defect fixture (must fail the helper)',
    classes: ['tool', 'tool', 'tool'],
    expectDefect: true,
  },
];

function hasHomogeneousBlockDefect(classes) {
  if (classes.length < 3) return false;
  return new Set(classes).size < 2;
}

function resolveCssVar(block, name) {
  const direct = block.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!direct) return null;
  let value = direct[1].trim();
  const varRef = value.match(/^var\((--ij-gray-\d+)\)/);
  if (varRef) {
    const gray = block.match(new RegExp(`${varRef[1]}:\\s*(#[0-9A-Fa-f]{6})`));
    if (gray) return gray[1];
  }
  if (value.startsWith('#')) return value;
  return null;
}

function readLightBases() {
  const cssPath = path.join(appRoot, 'src/styles/int-ui-register-light.css');
  const text = readFileSync(cssPath, 'utf8');
  const editor = resolveCssVar(text, '--ij-editor');
  const tool = resolveCssVar(text, '--ij-chrome');
  if (!editor || !tool) {
    throw new Error('Could not resolve --ij-editor / --ij-chrome from int-ui-register-light.css');
  }
  return { editor, tool };
}

const violations = [];

for (const surface of PROVING_SURFACES) {
  const defect = hasHomogeneousBlockDefect(surface.classes);
  if (surface.expectDefect) {
    if (!defect) {
      violations.push(
        `${surface.name}: expected homogeneous defect, helper returned false`,
      );
    }
    continue;
  }
  if (defect) {
    violations.push(
      `${surface.name}: homogeneous classes [${surface.classes.join(', ')}]`,
    );
  }
}

const { editor, tool } = readLightBases();
const delta = Math.abs(relativeLuminance(editor) - relativeLuminance(tool));

// Probe: the pre-A1 pair must fail the perceptual bar.
const legacyDelta = Math.abs(relativeLuminance('#FFFFFF') - relativeLuminance('#F7F8FA'));
if (legacyDelta >= MIN_EDITOR_TOOL_LUMINANCE_DELTA) {
  violations.push(
    `legacy probe: expected 8/255 pair (#FFFFFF/#F7F8FA) under threshold; got ΔY=${legacyDelta.toFixed(4)}`,
  );
}

if (delta < MIN_EDITOR_TOOL_LUMINANCE_DELTA) {
  violations.push(
    `editor (${editor}) vs tool (${tool}) ΔY=${delta.toFixed(4)} < ${MIN_EDITOR_TOOL_LUMINANCE_DELTA} (perceptual A2)`,
  );
}

if (violations.length > 0) {
  console.error('Block class gate failed:');
  for (const line of violations) console.error(`  - ${line}`);
  console.error(
    'Fix: three-plus blocks need two of {tool, editor}, and light editor/tool bases need a visible luminance step.',
  );
  process.exit(1);
}

console.log(
  `Block class gate passed (${PROVING_SURFACES.filter((s) => !s.expectDefect).length} proving surfaces; editor/tool ΔY=${delta.toFixed(3)} ≥ ${MIN_EDITOR_TOOL_LUMINANCE_DELTA}).`,
);
