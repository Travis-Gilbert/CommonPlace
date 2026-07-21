'use client';

// SOURCING: @xyflow/react custom edge contract. Both paths use the exact same
// Bezier geometry; the second path reveals progress through normalized length.
// Progress is the reported fraction only; easing is CSS transition between
// reported values and never extrapolates past the latest report.

import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useId } from 'react';
import type { GoalFlowEdge } from './plan-layout';

export function ProgressEdge(props: EdgeProps<GoalFlowEdge>) {
  const maskId = useId();
  const [path] = getBezierPath(props);
  const progress = Math.min(1, Math.max(0, props.data?.progress ?? 0));
  const state = props.data?.state ?? 'pending';
  const onPath = props.data?.onPath !== false;
  const stroke = state === 'failed'
    ? 'var(--ij-error)'
    : state === 'blocked'
      ? 'var(--ij-warn)'
    : state === 'verified'
      ? 'var(--ij-ok)'
      : 'var(--ij-accent)';
  return (
    <g data-goal-edge={state} data-on-path={onPath ? 'true' : 'false'} opacity={state === 'superseded' ? 0.36 : onPath ? 1 : 0.22}>
      <defs>
        <mask id={maskId} style={{ maskType: 'alpha' }}>
          <path
            d={path}
            fill="none"
            pathLength={1}
            stroke="var(--ij-ink-bright)"
            strokeWidth={4}
            strokeDasharray={`${progress} 1`}
          />
        </mask>
      </defs>
      <BaseEdge path={path} style={{ stroke: 'var(--ij-divider)', strokeWidth: 2 }} />
      <path
        d={path}
        fill="none"
        pathLength={1}
        stroke={stroke}
        strokeWidth={2}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
        className="goal-edge-progress"
      />
      {state === 'running' && progress > 0 ? (
        <path
          d={path}
          fill="none"
          pathLength={1}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray="0.045 0.035"
          mask={`url(#${maskId})`}
          className="goal-edge-running"
        />
      ) : null}
    </g>
  );
}
