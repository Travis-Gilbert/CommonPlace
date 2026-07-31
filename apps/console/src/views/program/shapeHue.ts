// SOURCING: @commonplace/canvas-substrate for the family union and its token
// map. This file keeps only the projection from a Rust `ShapeSpec` onto a
// family, which is genuine console-side knowledge; the hues themselves belong
// to the edge language and are not restated here (issue 144 B).

import type { ShapeSpec } from '@commonplace/program-contracts';
import { type EdgeFamily, familyStroke } from '@commonplace/canvas-substrate';

/**
 * Shape class and family are the same idea. The alias keeps existing call sites
 * reading naturally while there is exactly one definition, in the substrate.
 */
export type ShapeClass = EdgeFamily;

type ShapeKind = ShapeSpec['kind'];

/**
 * Every shape kind the Rust contract declares, mapped to a family.
 *
 * Declared as a total record over the generated `ShapeSpec['kind']` union, so a
 * new kind added on the Rust side fails the console typecheck instead of
 * silently rendering as a scalar wire with a text widget. `check:generated`
 * already guards the contract itself; this makes the projection over it total.
 */
const FAMILY_BY_SHAPE_KIND: Record<ShapeKind, EdgeFamily> = {
  graph_nodes: 'graph-plane',
  node_scores: 'graph-plane',
  tabular_any: 'tabular',
  tabular_pair: 'tabular',
  join_columns: 'tabular',
  preserve_columns: 'tabular',
  variables_declared_at_init: 'tensor-and-model',
  preserve_or_replace_variables: 'tensor-and-model',
  function: 'tensor-and-model',
  other: 'artifact-and-sink',
};

/**
 * A wire whose shape cannot be resolved still has to render. Falling back to
 * the scalar family keeps it visible rather than letting an unmapped kind
 * produce an invisible stroke; the exhaustive record above is what keeps that
 * fallback for genuinely unknown runtime values, not for new contract kinds.
 */
const UNRESOLVED_FAMILY: EdgeFamily = 'scalar-value';

/**
 * Whether an input of this shape can honestly be typed into.
 *
 * Editability is a different question from hue, so it gets its own total map
 * rather than being derived from the family: a variable bag and a tabular plane
 * can share a colour budget while only one of them is something a reader can
 * fill in by hand. Offering a JSON textarea in place of a table would be a fake
 * affordance; those inputs want a wire.
 *
 * Total over the generated union for the same reason as the family map: a new
 * Rust shape has to declare which side of this line it falls on.
 */
const WIDGETIZABLE_BY_SHAPE_KIND: Record<ShapeKind, boolean> = {
  graph_nodes: false,
  node_scores: false,
  tabular_any: false,
  tabular_pair: false,
  join_columns: false,
  preserve_columns: false,
  variables_declared_at_init: true,
  preserve_or_replace_variables: true,
  function: false,
  other: true,
};

export function isWidgetizableShape(shape: ShapeSpec | string | undefined): boolean {
  const kind = typeof shape === 'string' ? shape : shape?.kind;
  if (!kind) return false;
  return WIDGETIZABLE_BY_SHAPE_KIND[kind as ShapeKind] ?? false;
}

export function shapeClassFor(shape: ShapeSpec | string | undefined): ShapeClass {
  const kind = typeof shape === 'string' ? shape : shape?.kind;
  if (!kind) return UNRESOLVED_FAMILY;
  return FAMILY_BY_SHAPE_KIND[kind as ShapeKind] ?? UNRESOLVED_FAMILY;
}

/** Re-exported so callers keep one import for the family and its token. */
export { familyStroke, familyStroke as hueForShapeClass };
export type { EdgeFamily };
