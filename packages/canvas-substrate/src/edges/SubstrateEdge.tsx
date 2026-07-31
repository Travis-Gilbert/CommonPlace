'use client';

// SOURCING: @xyflow/react BaseEdge/getBezierPath/EdgeLabelRenderer — vendor the
// edge primitives; the dash law and palettes are the substrate's (issue #144 B).
//
// One edge component serves both canvases. The palette is the only difference,
// and it arrives as data. The march animation is a class defined in the console
// motion register: this component never declares keyframes, so the motion stays
// reviewable where the design system keeps every other animation.

import { memo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { EdgeFamily, EdgePaletteId } from '../kinds/types';
import { edgeAttention, edgeStroke, edgeStrokeStyle } from './law';
import { waypointLabelAnchor, waypointPath, type Point } from './waypoints';

export interface SubstrateEdgeData {
  readonly palette?: EdgePaletteId;
  /** Source port's shape class. Ignored by the model palette. */
  readonly family?: EdgeFamily;
  /** Reroute dots from the layout document. */
  readonly waypoints?: readonly Point[];
  /** True while this edge is carrying a running program step. */
  readonly running?: boolean;
  /**
   * Whether this running edge won a slot in the animation budget. False keeps
   * the width bump and drops the march, which is also the reduced-motion state.
   */
  readonly marching?: boolean;
  /** Relation chip: the model palette's way of carrying information. */
  readonly label?: string;
  /** Cardinality glyph, e.g. `N:N`. */
  readonly cardinality?: string;
  /** Rendered as a dashed advisory label when the schema is unknown. */
  readonly note?: string;
  readonly onWaypointMove?: (index: number, point: Point) => void;
  readonly onWaypointRemove?: (index: number) => void;
}

function SubstrateEdgeInner(props: EdgeProps) {
  const data = (props.data ?? {}) as SubstrateEdgeData;
  const [hovered, setHovered] = useState(false);
  const palette = data.palette ?? 'program';
  const attention = edgeAttention(props.selected, hovered);
  const stroke = edgeStroke(palette, data.family, attention);
  const strokeStyle = edgeStrokeStyle(attention);

  const source: Point = { x: props.sourceX, y: props.sourceY };
  const target: Point = { x: props.targetX, y: props.targetY };
  const waypoints = data.waypoints ?? [];

  const [bezierPath, bezierLabelX, bezierLabelY] = getBezierPath(props);
  const routed = waypointPath(source, target, waypoints);
  const path = routed ?? bezierPath;
  const anchor = routed
    ? waypointLabelAnchor(source, target, waypoints)
    : { x: bezierLabelX, y: bezierLabelY };

  const chip = data.label || data.cardinality || data.note;

  return (
    <>
      {/* A 1.5px dotted line is a small target. This invisible companion widens
          the hit area without widening the mark, so hover and reroute stay
          reachable at the stroke weight the language actually calls for. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        style={{ pointerEvents: 'stroke' }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        data-substrate-edge-hit={props.id}
      />
      <BaseEdge
        id={props.id}
        path={path}
        className={data.running && data.marching ? 'substrate-edge-running' : undefined}
        style={{ stroke, ...strokeStyle }}
        data-substrate-edge={palette}
        data-running={data.running ? 'true' : undefined}
      />

      {waypoints.map((point, index) => (
        <circle
          key={`${props.id}:wp:${index}`}
          cx={point.x}
          cy={point.y}
          r={attention === 'attended' ? 4 : 3}
          fill="var(--ij-raised)"
          stroke={stroke}
          strokeWidth={1.5}
          className="substrate-waypoint"
          data-substrate-waypoint={index}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onDoubleClick={(event) => {
            event.stopPropagation();
            data.onWaypointRemove?.(index);
          }}
        />
      ))}

      {chip ? (
        <EdgeLabelRenderer>
          <span
            className={[
              'nodrag nopan absolute inline-flex items-center gap-1.5 rounded-ij-arc border bg-ij-raised px-1.5 py-0.5 text-xs',
              props.selected ? 'border-ij-accent' : 'border-ij-seam-raised',
              data.note ? 'text-ij-ink-info' : 'text-ij-ink',
            ].join(' ')}
            style={{
              transform: `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y}px)`,
            }}
            data-substrate-edge-chip={props.id}
          >
            {data.label ? (
              <span className="font-ij-mono" data-mono-ok>
                {data.label}
              </span>
            ) : null}
            {data.cardinality ? (
              <span
                className="rounded-ij-arc-underline bg-ij-selection px-1 font-ij-mono text-xs font-bold text-ij-accent"
                data-mono-ok
              >
                {data.cardinality}
              </span>
            ) : null}
            {data.note ? <span>{data.note}</span> : null}
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const SubstrateEdge = memo(SubstrateEdgeInner);
