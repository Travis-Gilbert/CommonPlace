'use client';

// SOURCING: @xyflow/react BaseEdge. Shape-class tinted bezier (PG5).

import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { hueForShapeClass, type ShapeClass } from './shapeHue';
import type { EdgeSchemaStatus } from './connection';

export type ProgramEdgeData = {
  readonly shapeClass?: ShapeClass;
  readonly status?: EdgeSchemaStatus;
};

function ProgramEdgeViewInner(props: EdgeProps) {
  const data = props.data as ProgramEdgeData | undefined;
  const [path, labelX, labelY] = getBezierPath(props);
  const stroke = hueForShapeClass(data?.shapeClass ?? 'scalar-value');
  const dashed = data?.status === 'undetermined';
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        style={{
          stroke,
          strokeWidth: props.selected ? 2.5 : 1.75,
          strokeDasharray: dashed ? '6 4' : undefined,
        }}
      />
      {dashed ? (
        <EdgeLabelRenderer>
          <span
            className="nodrag nopan pointer-events-none absolute rounded-ij-arc border border-ij-seam bg-ij-raised px-1.5 py-0.5 font-ij-mono text-xs text-ij-ink-info"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            data-program-edge-status="undetermined"
          >
            schema unknown
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const ProgramEdgeView = memo(ProgramEdgeViewInner);
