// SOURCING: none. Kind hue accessors for SPEC-MATERIAL-REGISTER-1.0 D4.
// Values live in register-bridge.css as --ij-kind-*; this module only names them.

import type { BlockKindGlyph } from '@commonplace/block-view/types';

/** Closed kind list: keep in sync with BlockKindGlyph and --ij-kind-* in the register. */
export const KIND_GLYPH_ORDER = [
  'records',
  'cards',
  'thread',
  'doc',
  'memory',
  'rail',
  'workspace',
  'model',
  'files',
  'context',
  'terminal',
  'browser',
  'kanban',
  'automation',
  'canvas',
] as const satisfies readonly BlockKindGlyph[];

/** Fixed ramp used when regenerating --ij-kind-* in register-bridge.css. */
export const KIND_HUE_LIGHTNESS = 0.65;
export const KIND_HUE_CHROMA = 0.12;

export function kindHueVar(kind: BlockKindGlyph | undefined): string {
  const key = kind && (KIND_GLYPH_ORDER as readonly string[]).includes(kind) ? kind : 'records';
  return `var(--ij-kind-${key})`;
}

/** Alias for glyph/edge call sites. */
export function kindHueCss(kind: BlockKindGlyph | undefined): string {
  return kindHueVar(kind);
}

export function kindHueDegrees(kind: BlockKindGlyph): number {
  const index = KIND_GLYPH_ORDER.indexOf(kind);
  return (Math.max(0, index) * 360) / KIND_GLYPH_ORDER.length;
}
