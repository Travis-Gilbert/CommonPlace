'use client';

// SOURCING: @xyflow/react ConnectionLineComponentProps + getBezierPath — vendor
// the drag geometry so the preview matches the committed edge exactly.
//
// The preview wears the source family and the resting dash, so what the reader
// drags is visibly the same wire they will get (issue 144 B).

import { getBezierPath, Position, type ConnectionLineComponentProps } from '@xyflow/react';
import type { EdgeFamily } from '../kinds/types';
import { edgeStrokeStyle, familyStroke } from './law';

export interface SubstrateConnectionLineProps extends ConnectionLineComponentProps {
  readonly family?: EdgeFamily;
}

export function makeConnectionLine(
  familyForHandle: (nodeId: string, handleId: string | null) => EdgeFamily | undefined,
) {
  return function SubstrateConnectionLine({
    fromX,
    fromY,
    toX,
    toY,
    fromPosition,
    toPosition,
    fromNode,
    fromHandle,
  }: ConnectionLineComponentProps) {
    const [path] = getBezierPath({
      sourceX: fromX,
      sourceY: fromY,
      sourcePosition: fromPosition ?? Position.Right,
      targetX: toX,
      targetY: toY,
      targetPosition: toPosition ?? Position.Left,
    });
    const family = fromNode ? familyForHandle(fromNode.id, fromHandle?.id ?? null) : undefined;
    return (
      <path
        d={path}
        fill="none"
        stroke={family ? familyStroke(family) : 'var(--ij-ink-info)'}
        {...edgeStrokeStyle('rest')}
        data-substrate-connection-line
      />
    );
  };
}
