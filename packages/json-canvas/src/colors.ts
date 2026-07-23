// SOURCING: none — pure logic, no upstream component applies.
// Preset mapping is console register tokens per SPEC-DATA-CANVAS D5.

/**
 * JSON Canvas preset colors mapped to Int UI register tokens (D5).
 * Hex colors are accepted on import and preserved on the carrying object.
 */

import type { CanvasColor, CanvasColorPreset } from './types';

/** Preset 1-6 -> console register CSS variables. */
export const PRESET_TO_IJ_TOKEN: Record<CanvasColorPreset, string> = {
  '1': 'var(--ij-error)',
  '2': 'var(--ij-warn)',
  '3': 'var(--ij-gold)',
  '4': 'var(--ij-success)',
  '5': 'var(--ij-link)',
  '6': 'var(--ij-accent)',
};

const PRESET_SET = new Set<string>(['1', '2', '3', '4', '5', '6']);

export function isCanvasPreset(color: string): color is CanvasColorPreset {
  return PRESET_SET.has(color);
}

/** Resolves a canvasColor to a usable CSS value for console rendering. */
export function resolveCanvasColor(color: CanvasColor | undefined): string | undefined {
  if (!color) return undefined;
  if (isCanvasPreset(color)) return PRESET_TO_IJ_TOKEN[color];
  return color;
}

/**
 * Prefer presets on export when the stored color is already a preset.
 * Hex stays hex so Obsidian round-trips preserve authored values.
 */
export function exportCanvasColor(color: CanvasColor | undefined): CanvasColor | undefined {
  return color;
}
