'use client';

// Custom XYFlow edge: draws a typed, directed relation with cardinality
// marks. The direction arrow (markerStart / markerEnd) shows which way the
// relation points; the "1" / "N" marks sitting just inside each endpoint
// show the inferred cardinality (see deriveCardinality in canvas-logic).
// RelationDef carries no cardinality field, so the mark is read off the
// canvas's own derived edge model. Uses the existing SVG smooth-step path.

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  MarkerType,
  type EdgeProps,
} from '@xyflow/react';
import type { EdgeCardinality } from './canvas-logic';
import styles from './data-canvas.module.css';

export interface RelationEdgeData {
  label: string;
  targetType?: string;
  dir: 'in' | 'out';
  cardinality?: EdgeCardinality;
  [key: string]: unknown;
}

// "1" / "N" notation for the source and target ends of an edge, per
// cardinality. Legible alongside the direction arrow without the geometry
// of custom crow's-foot SVG markers.
const CARDINALITY_MARKS: Record<
  EdgeCardinality,
  { readonly source: string; readonly target: string }
> = {
  'one-to-one': { source: '1', target: '1' },
  'one-to-many': { source: '1', target: 'N' },
  'many-to-one': { source: 'N', target: '1' },
  'many-to-many': { source: 'N', target: 'N' },
};

// Pull a point a fixed distance from an endpoint toward the edge middle so
// the cardinality mark sits just off the node rather than under its handle.
function inset(
  fromX: number,
  fromY: number,
  towardX: number,
  towardY: number,
  distance: number,
): { x: number; y: number } {
  const dx = towardX - fromX;
  const dy = towardY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  return { x: fromX + (dx / len) * distance, y: fromY + (dy / len) * distance };
}

export function RelationEdge(props: EdgeProps) {
  const d = props.data as RelationEdgeData | undefined;
  const [edgePath, labelX, labelY] = getSmoothStepPath(props);
  const marks = d?.cardinality ? CARDINALITY_MARKS[d.cardinality] : undefined;

  const sourceMark = marks
    ? inset(props.sourceX, props.sourceY, labelX, labelY, 16)
    : null;
  const targetMark = marks
    ? inset(props.targetX, props.targetY, labelX, labelY, 16)
    : null;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={d?.dir === 'out' ? MarkerType.ArrowClosed : undefined}
        markerStart={d?.dir === 'in' ? MarkerType.ArrowClosed : undefined}
        style={{ stroke: 'var(--hair)', strokeWidth: 2 }}
      />
      <EdgeLabelRenderer>
        {marks && sourceMark && targetMark ? (
          <>
            <div
              className={styles.edgeLabel}
              style={{
                transform: `translate(-50%, -50%) translate(${sourceMark.x}px, ${sourceMark.y}px)`,
              }}
              aria-hidden
            >
              {marks.source}
            </div>
            <div
              className={styles.edgeLabel}
              style={{
                transform: `translate(-50%, -50%) translate(${targetMark.x}px, ${targetMark.y}px)`,
              }}
              aria-hidden
            >
              {marks.target}
            </div>
          </>
        ) : null}
        <div
          className={styles.edgeLabel}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          title={d?.cardinality ? `${d.label} (${d.cardinality})` : d?.label}
        >
          {d?.label ?? ''}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
