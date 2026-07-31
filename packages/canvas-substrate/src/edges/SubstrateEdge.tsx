'use client';

// SOURCING: @xyflow/react BaseEdge/getBezierPath/EdgeLabelRenderer — vendor the
// edge primitives; the dash law and palettes are the substrate's (issue 144 B).
//
// One edge component serves both canvases. The palette is the only difference,
// and it arrives as data. Execution motion is a class defined in the console
// motion register: this component never declares keyframes, so the motion stays
// reviewable where the design system keeps every other animation.

import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import type { EdgeFamily, EdgePaletteId } from '../kinds/types';
import { RUNNING_EDGE_PIP_STOPS, edgeAttention, edgeStroke, edgeStrokeStyle } from './law';
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
   * the width bump and drops the pips, which is also the reduced-motion state.
   */
  readonly marching?: boolean;
  /** Relation chip: the model palette's way of carrying information. */
  readonly label?: string;
  /** Cardinality glyph, e.g. `N:N`. */
  readonly cardinality?: string;
  /** Rendered as an advisory label when the schema is unknown. */
  readonly note?: string;
  /**
   * Relation direction. The dotted wire carries no direction on its own, and an
   * ERD relation genuinely has one, so the model palette keeps an arrowhead.
   * Program wires read direction from port sides and leave this unset.
   */
  readonly arrow?: 'end' | 'both';
  readonly onWaypointMove?: (index: number, point: Point) => void;
  readonly onWaypointRemove?: (index: number) => void;
}

function SubstrateEdgeInner(props: EdgeProps) {
  const data = (props.data ?? {}) as SubstrateEdgeData;
  const { screenToFlowPosition } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const palette = data.palette ?? 'program';
  const attention = edgeAttention(props.selected, hovered);
  const stroke = edgeStroke(palette, data.family, attention);
  const strokeStyle = edgeStrokeStyle(attention, data.running);

  const source: Point = { x: props.sourceX, y: props.sourceY };
  const target: Point = { x: props.targetX, y: props.targetY };
  const waypoints = data.waypoints ?? [];

  const [bezierPath, bezierLabelX, bezierLabelY] = getBezierPath(props);
  const routed = waypointPath(source, target, waypoints);
  const path = routed ?? bezierPath;
  const anchor = routed
    ? waypointLabelAnchor(source, target, waypoints)
    : { x: bezierLabelX, y: bezierLabelY };

  const showPips = Boolean(data.running && data.marching);
  const measureRef = useRef<SVGPathElement | null>(null);
  const pips = usePipPoints(measureRef, path, showPips);

  const chip = data.label || data.cardinality || data.note;
  const arrowEnd = data.arrow ? `substrate-arrow-end-${props.id}` : undefined;
  const arrowStart = data.arrow === 'both' ? `substrate-arrow-start-${props.id}` : undefined;

  const onWaypointMove = data.onWaypointMove;
  const dragWaypoint = useCallback(
    (index: number, event: React.PointerEvent<SVGCircleElement>) => {
      if (!onWaypointMove) return;
      event.stopPropagation();
      const element = event.currentTarget;
      element.setPointerCapture(event.pointerId);
      const move = (moveEvent: PointerEvent) => {
        onWaypointMove(
          index,
          screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY }),
        );
      };
      const stop = () => {
        element.releasePointerCapture(event.pointerId);
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', stop);
        element.removeEventListener('pointercancel', stop);
      };
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', stop);
      element.addEventListener('pointercancel', stop);
    },
    [onWaypointMove, screenToFlowPosition],
  );

  return (
    <>
      {data.arrow ? (
        <defs>
          <marker
            id={arrowEnd}
            markerWidth="9"
            markerHeight="9"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L7,3 L0,6 z" fill={stroke} />
          </marker>
          {arrowStart ? (
            <marker
              id={arrowStart}
              markerWidth="9"
              markerHeight="9"
              refX="0"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M7,0 L0,3 L7,6 z" fill={stroke} />
            </marker>
          ) : null}
        </defs>
      ) : null}

      {/* A 1.5px dotted line is a small target. This invisible companion widens
          the hit area without widening the mark, so hover and reroute stay
          reachable at the stroke weight the language actually calls for. It
          doubles as the measuring path for the direction pips. */}
      <path
        ref={measureRef}
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
        markerEnd={arrowEnd ? `url(#${arrowEnd})` : undefined}
        markerStart={arrowStart ? `url(#${arrowStart})` : undefined}
        style={{ stroke, ...strokeStyle }}
        data-substrate-edge={palette}
        data-running={data.running ? 'true' : undefined}
      />

      {/* Direction pips: a staggered opacity cascade from producer to consumer.
          Opacity only, per the console motion constitution. */}
      {pips.map((point, index) => (
        <circle
          key={`${props.id}:pip:${index}`}
          cx={point.x}
          cy={point.y}
          r={2.5}
          fill={stroke}
          className="substrate-edge-pip"
          data-substrate-pip={index}
          aria-hidden="true"
        />
      ))}

      {waypoints.map((point, index) => (
        <circle
          key={`${props.id}:wp:${index}`}
          cx={point.x}
          cy={point.y}
          r={attention === 'attended' ? 4 : 3}
          fill="var(--ij-raised)"
          stroke={stroke}
          strokeWidth={1.5}
          className="substrate-waypoint nodrag nopan"
          data-substrate-waypoint={index}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onPointerDown={(event) => dragWaypoint(index, event)}
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

/**
 * Sample the rendered path so the direction pips sit on the curve. Bound to the
 * caller's ref so the invisible hit path serves as the measuring path too.
 * Measured in a layout effect keyed on the path data, so this runs once per
 * geometry change: never per animation frame.
 */
function usePipPoints(
  ref: React.RefObject<SVGPathElement | null>,
  path: string,
  enabled: boolean,
): Point[] {
  const [points, setPoints] = useState<Point[]>([]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) {
      setPoints((current) => (current.length === 0 ? current : []));
      return;
    }
    const total = element.getTotalLength();
    if (!Number.isFinite(total) || total <= 0) return;
    setPoints(
      RUNNING_EDGE_PIP_STOPS.map((stop) => {
        const point = element.getPointAtLength(total * stop);
        return { x: point.x, y: point.y };
      }),
    );
  }, [enabled, path, ref]);
  return points;
}

export const SubstrateEdge = memo(SubstrateEdgeInner);
