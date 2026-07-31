// SOURCING: d3-shape (line + curveCatmullRom) — vendor spline generation for
// rerouted edges rather than hand-rolling the Catmull-Rom to cubic conversion.
// Un-rerouted edges keep @xyflow/react's getBezierPath so their handle tangents
// stay identical to every other React Flow edge on the canvas.
//
// Waypoints are ComfyUI reroute dots. They are layout, not semantics: they live
// in the canvas layout document beside positions and never touch edge identity.

import { line as d3Line, curveCatmullRom } from 'd3-shape';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Catmull-Rom keeps the curve passing exactly through each dropped dot, which
 * is what a reroute handle has to promise. alpha=0.5 (centripetal) is the
 * variant that will not cusp or self-intersect when two dots sit close
 * together -- a uniform spline visibly loops there.
 */
const splinePath = d3Line<Point>()
  .x((point) => point.x)
  .y((point) => point.y)
  .curve(curveCatmullRom.alpha(0.5));

/**
 * Build the routed path through waypoints. Returns null when there are no
 * waypoints so the caller can fall back to React Flow's own bezier.
 */
export function waypointPath(
  source: Point,
  target: Point,
  waypoints: readonly Point[],
): string | null {
  if (waypoints.length === 0) return null;
  return splinePath([source, ...waypoints, target]);
}

/** Midpoint of the routed run, used to place the edge label. */
export function waypointLabelAnchor(
  source: Point,
  target: Point,
  waypoints: readonly Point[],
): Point {
  const points = [source, ...waypoints, target];
  const middle = (points.length - 1) / 2;
  const low = points[Math.floor(middle)];
  const high = points[Math.ceil(middle)];
  return { x: (low.x + high.x) / 2, y: (low.y + high.y) / 2 };
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * Index at which a new dot dropped at `point` should be spliced in. Chooses the
 * run the click was actually nearest to, so dropping a dot on the far leg of an
 * already-rerouted edge does not reorder the near one.
 */
export function insertionIndex(
  source: Point,
  target: Point,
  waypoints: readonly Point[],
  point: Point,
): number {
  const points = [source, ...waypoints, target];
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(point, points[index], points[index + 1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

export function insertWaypoint(
  source: Point,
  target: Point,
  waypoints: readonly Point[],
  point: Point,
): Point[] {
  const next = [...waypoints];
  next.splice(insertionIndex(source, target, waypoints, point), 0, point);
  return next;
}

export function moveWaypoint(
  waypoints: readonly Point[],
  index: number,
  point: Point,
): Point[] {
  if (index < 0 || index >= waypoints.length) return [...waypoints];
  const next = [...waypoints];
  next[index] = point;
  return next;
}

export function removeWaypoint(waypoints: readonly Point[], index: number): Point[] {
  if (index < 0 || index >= waypoints.length) return [...waypoints];
  return waypoints.filter((_, position) => position !== index);
}
