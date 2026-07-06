// @commonplace/coannotate — the co-annotation overlay spine (SPEC-PREVIEW-COANNOTATION).
//
// One overlay, three mounts. This package is the FRAMEWORK-AGNOSTIC core consumed
// by the dev-preview mount, the general browser mount, and browse_with_me: the
// anchor/annotation types (wire-parity with the Rust store), the annotation
// client, and the agent-cursor glide. The DOM/visual binding (the actual overlay
// elements, the rubricated-numeral + leader-line rendering, source-attribute
// reading from live elements) lands in the mount surfaces, on top of this core.

export type {
  Anchor,
  Annotation,
  AuthorKind,
  Cursor,
  CursorGesture,
  MarkKind,
  Point,
  Rect,
  Resolution,
} from './types.ts';
export { anchorLabel, parseAnchor } from './types.ts';

export {
  clamp01,
  CursorGlide,
  easeInOutCubic,
  glideDurationFor,
  lerpPoint,
  rectCenter,
} from './easing.ts';

export type {
  AnchorEl,
  AnchorRoot,
  MutationObserverLike,
  SourceLoc,
} from './anchor-dom.ts';
export {
  observeReanchor,
  parseSourceAttr,
  reanchor,
  readSourceAnchor,
  resolveAnchorEl,
  resolveAnchorRect,
  robustSelector,
  selectorAnchor,
  SOURCE_ATTR,
} from './anchor-dom.ts';

export type {
  CreateAnnotationInput,
  GraphqlFetcher,
  ReplyInput,
  ResolveInput,
} from './annotation-client.ts';
export {
  annotationFromGraphql,
  annotationsForTarget,
  buildCreateAnnotation,
  createAnnotation,
  replyToAnnotation,
  resolveAnnotation,
} from './annotation-client.ts';

export type { CommitTouch, FixThisRequest, TouchedRange } from './fix-this.ts';
export { autoResolveOnCommit, buildFixThisRequest, touchesAnchor } from './fix-this.ts';

import { CursorGlide, glideDurationFor, rectCenter } from './easing.ts';
import type { Point, Rect } from './types.ts';

function isRectTarget(target: Rect | Point): target is Rect {
  return 'width' in target && 'height' in target;
}

/**
 * The headless agent-cursor state (D5): it glides toward a target (a resolved
 * anchor rect, or a point) with eased motion, sampled by elapsed time. The mount
 * renders `sample(now)` each frame. It never teleports: a new glide starts from
 * the current sampled position.
 */
export class AgentCursorController {
  private glide: CursorGlide | null = null;
  private startMs = 0;
  private pos: Point;
  private readonly opts?: { minMs?: number; maxMs?: number; pxPerMs?: number };

  constructor(start: Point, opts?: { minMs?: number; maxMs?: number; pxPerMs?: number }) {
    this.pos = { ...start };
    this.opts = opts;
  }

  /** Begin an eased glide toward a rect center (or a point) starting at `nowMs`. */
  glideTo(target: Rect | Point, nowMs: number): void {
    // Start from where the cursor currently IS (per the last sample), so a
    // re-target mid-glide continues smoothly rather than snapping.
    const from = { ...this.pos };
    const to = isRectTarget(target) ? rectCenter(target) : { ...target };
    const durationMs = glideDurationFor(from, to, this.opts);
    this.glide = new CursorGlide(from, to, durationMs);
    this.startMs = nowMs;
  }

  /** The cursor position at `nowMs`. Advances the internal position. */
  sample(nowMs: number): Point {
    if (this.glide) {
      this.pos = this.glide.sample(nowMs - this.startMs);
    }
    return { ...this.pos };
  }

  /** Whether the current glide (if any) has reached its target by `nowMs`. */
  arrived(nowMs: number): boolean {
    return this.glide == null || this.glide.arrived(nowMs - this.startMs);
  }
}
