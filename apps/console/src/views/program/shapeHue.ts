// SOURCING: none. Functional shape-class hue encoding for program wires (PG5).

import type { ShapeSpec } from '@commonplace/program-contracts';

export type ShapeClass =
  | 'graph-plane'
  | 'tabular'
  | 'tensor-and-model'
  | 'scalar-value'
  | 'artifact-and-sink';

export function shapeClassFor(shape: ShapeSpec | string | undefined): ShapeClass {
  const kind = typeof shape === 'string' ? shape : shape?.kind;
  switch (kind) {
    case 'graph_nodes':
    case 'node_scores':
      return 'graph-plane';
    case 'tabular_any':
    case 'tabular_pair':
    case 'join_columns':
    case 'preserve_columns':
      return 'tabular';
    case 'variables_declared_at_init':
    case 'preserve_or_replace_variables':
    case 'function':
      return 'tensor-and-model';
    case 'other':
      return 'artifact-and-sink';
    default:
      return 'scalar-value';
  }
}

/** Semantic register hues for the five shape classes. */
export function hueForShapeClass(shapeClass: ShapeClass): string {
  switch (shapeClass) {
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
