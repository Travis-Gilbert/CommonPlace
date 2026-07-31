// SOURCING: none — the substrate edge language (issue #144 B), pure constants
// and pure functions. Rendering binds to @xyflow/react in SubstrateEdge.
//
// One geometry and one dash system across both canvases; only the palette
// differs. The dash is the whole idea: `0.1 6` with a round linecap collapses
// each dash to a dot, which reads as Railway's dotted wire rather than
// ComfyUI's solid rope. Hover and selection tighten the dash toward `4 3`
// instead of switching to a solid stroke, so the edge appears to solidify
// under attention rather than jumping to a different visual state.

import type { EdgeFamily, EdgePaletteId } from '../kinds/types';

/** Cubic bezier only. Orthogonal elbows are not part of this language. */
export const EDGE_GEOMETRY = 'bezier' as const;

export const EDGE_STROKE = {
  rest: 1.5,
  attended: 2,
} as const;

/**
 * Round dots at rest, tightened dashes under attention. Values are SVG user
 * units on an un-normalized path, so a dash cycle is `0.1 + 6 = 6.1` units.
 */
export const EDGE_DASH = {
  rest: '0.1 6',
  attended: '4 3',
} as const;

/** One dash cycle at rest. Marching by exactly this reads as seamless. */
export const EDGE_DASH_CYCLE = 6.1;

export const EDGE_LINECAP = 'round' as const;

/**
 * Concurrently animated running edges are capped so a wide fan-out cannot turn
 * the canvas into a strobe. Past the cap, running edges keep the width bump and
 * drop the march. Reduced motion drops the march at any count.
 */
export const RUNNING_EDGE_ANIMATION_CAP = 40;

export type EdgeAttention = 'rest' | 'attended';

export function edgeAttention(
  selected: boolean | undefined,
  hovered: boolean | undefined,
): EdgeAttention {
  return selected || hovered ? 'attended' : 'rest';
}

export interface EdgeStrokeStyle {
  readonly strokeWidth: number;
  readonly strokeDasharray: string;
  readonly strokeLinecap: typeof EDGE_LINECAP;
}

export function edgeStrokeStyle(attention: EdgeAttention): EdgeStrokeStyle {
  return {
    strokeWidth: EDGE_STROKE[attention],
    strokeDasharray: EDGE_DASH[attention],
    strokeLinecap: EDGE_LINECAP,
  };
}

/**
 * Program wires take the source port's shape-class family. Model relation edges
 * stay neutral: a relation is not a typed flow, and colouring one would spend
 * hue on a distinction the chip and cardinality glyph already carry.
 */
export function edgeStroke(
  palette: EdgePaletteId,
  family: EdgeFamily | undefined,
  attention: EdgeAttention,
): string {
  if (palette === 'model') {
    return attention === 'attended' ? 'var(--ij-accent)' : 'var(--ij-ink-info)';
  }
  return familyStroke(family ?? 'scalar-value');
}

/** The five shape-class hues, already registered as console tokens. */
export function familyStroke(family: EdgeFamily): string {
  switch (family) {
    case 'graph-plane':
      return 'var(--ij-program-shape-graph)';
    case 'tabular':
      return 'var(--ij-program-shape-tabular)';
    case 'tensor-and-model':
      return 'var(--ij-program-shape-tensor)';
    case 'scalar-value':
      return 'var(--ij-program-shape-scalar)';
    case 'artifact-and-sink':
      return 'var(--ij-program-shape-artifact)';
  }
}

/**
 * Decide, for one frame of the graph, which running edges may march. Callers
 * pass every running edge id in a stable order; the first `cap` win. Returning
 * a set rather than mutating keeps this testable and keeps the decision out of
 * render.
 */
export function marchingEdgeIds(
  runningEdgeIds: readonly string[],
  options: { readonly reducedMotion: boolean; readonly cap?: number },
): ReadonlySet<string> {
  if (options.reducedMotion) return new Set();
  const cap = options.cap ?? RUNNING_EDGE_ANIMATION_CAP;
  return new Set(runningEdgeIds.slice(0, Math.max(0, cap)));
}
