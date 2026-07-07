// Agent-cursor glide math (SPEC-PREVIEW-COANNOTATION D5): the agent cursor "moves
// with eased glides, never teleports". Pure functions of elapsed time so the
// motion is deterministic and testable without a DOM or a clock.

import type { Point, Rect } from './types.ts';

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Standard ease-in-out cubic on [0,1]. */
export function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function lerpPoint(from: Point, to: Point, eased: number): Point {
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  };
}

/**
 * An eased glide from `from` to `to` over `durationMs`. `sample(elapsedMs)` is a
 * pure function of elapsed time: it starts exactly AT `from` (no teleport) and
 * ends exactly AT `to`, easing in between. A zero/negative duration snaps to the
 * target (used when the cursor is already there).
 */
export class CursorGlide {
  readonly from: Point;
  readonly to: Point;
  readonly durationMs: number;

  constructor(from: Point, to: Point, durationMs: number) {
    this.from = from;
    this.to = to;
    this.durationMs = durationMs;
  }

  sample(elapsedMs: number): Point {
    if (this.durationMs <= 0) return { ...this.to };
    const t = clamp01(elapsedMs / this.durationMs);
    return lerpPoint(this.from, this.to, easeInOutCubic(t));
  }

  arrived(elapsedMs: number): boolean {
    return elapsedMs >= this.durationMs;
  }
}

/**
 * A natural glide duration for a move: scales with distance (a longer move takes
 * longer), clamped to a min/max so a tiny nudge is not instant and a cross-screen
 * move is not sluggish.
 */
export function glideDurationFor(
  from: Point,
  to: Point,
  opts?: { minMs?: number; maxMs?: number; pxPerMs?: number },
): number {
  const minMs = opts?.minMs ?? 180;
  const maxMs = opts?.maxMs ?? 900;
  const pxPerMs = opts?.pxPerMs ?? 1.6;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(minMs, Math.min(maxMs, dist / pxPerMs));
}
