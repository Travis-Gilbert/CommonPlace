'use client';

// SOURCING: @xyflow/react custom edge contract (BaseEdge + getSmoothStepPath).

import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { ModelFlowEdge } from './layout';

export function RelationEdge(props: EdgeProps<ModelFlowEdge>) {
  const [path] = getSmoothStepPath({
    ...props,
    borderRadius: 8,
  });
  const label = props.data?.label ?? '';
  const cardinalityLabel = props.data?.cardinalityLabel ?? '';
  const coverage = props.data?.coverage;
  const occurrences = props.data?.occurrences;
  const titleParts = [
    label,
    cardinalityLabel,
    coverage !== undefined ? `coverage ${Math.round(coverage * 100)}%` : '',
    occurrences !== undefined ? `${occurrences} events` : '',
  ].filter(Boolean);

  return (
    <>
      {titleParts.length > 0 ? <title>{titleParts.join(' · ')}</title> : null}
      <BaseEdge
        path={path}
        style={{
          stroke: 'var(--ij-seam-raised)',
          strokeWidth: 1,
        }}
      />
    </>
  );
}
