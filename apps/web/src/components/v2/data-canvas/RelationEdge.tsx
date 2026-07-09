'use client';

// Custom XYFlow edge: displays the relation edge label and cardinality
// (direction + target type) along the edge path. Uses MarkerType for
// proper SVG arrow rendering.

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  MarkerType,
  type EdgeProps,
} from '@xyflow/react';
import styles from './data-canvas.module.css';

export interface RelationEdgeData {
  label: string;
  targetType?: string;
  dir: 'in' | 'out';
  [key: string]: unknown;
}

export function RelationEdge(props: EdgeProps) {
  const d = props.data as RelationEdgeData | undefined;
  const [edgePath, labelX, labelY] = getSmoothStepPath(props);

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={d?.dir === 'out' ? MarkerType.ArrowClosed : undefined}
        markerStart={d?.dir === 'in' ? MarkerType.ArrowClosed : undefined}
        style={{ stroke: 'var(--hair)', strokeWidth: 2 }}
      />
      <EdgeLabelRenderer>
        <div
          className={styles.edgeLabel}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {d?.label ?? ''}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
