// The annotate-to-patch loop (SPEC-PREVIEW-COANNOTATION D6).
//
// "Every annotation thread carries a Fix this action that dispatches a scoped
// prompt to the head: the anchor (file, line, column), a screenshot crop of the
// region, and the thread text. ... the annotation auto-resolves when a commit
// touches its anchored lines, or the head resolves it in-thread with a receipt."
//
// This module is the transport-agnostic core: it ASSEMBLES the scoped dispatch
// payload and decides commit-triggered auto-resolution. The actual dispatch (to
// the run channel), the diff card, the HMR repaint, and the screenshot capture
// are the mount/back-end wiring on top of this.

import type { Annotation, Anchor, Resolution } from './types.ts';
import { anchorLabel } from './types.ts';

const MISSING_ANCHOR_URL = 'about:blank#missing-annotation-anchor';
const MISSING_ANCHOR_LABEL = 'missing annotation anchor';

/** A scoped Fix-this dispatch: everything the head needs, nothing it does not. */
export interface FixThisRequest {
  annotationId: string;
  /** Where the problem is (file:line:column in dev mode; selector/page otherwise). */
  anchor: Anchor;
  /** A one-line human anchor label for the prompt (`path:line:col`). */
  anchorLabel: string;
  /** The thread text: the annotation body plus its replies, oldest-first. */
  thread: string;
  /** An opaque reference to the region screenshot crop, when the mount captured one. */
  screenshotRef?: string;
}

/** Build the scoped dispatch payload for a Fix-this action (D6). `thread` is the
 * annotation plus its replies in chronological order (the mount passes replies
 * newest-first, as `annotations_for` returns them, so we reverse). */
export function buildFixThisRequest(
  annotation: Annotation,
  replies: Annotation[] = [],
  screenshotRef?: string,
): FixThisRequest {
  const chronological = [annotation, ...[...replies].reverse()];
  const thread = chronological
    .map((entry) => {
      const who = entry.author ?? (entry.authorKind ?? 'someone');
      return `${who}: ${entry.body}`;
    })
    .join('\n');
  return {
    annotationId: annotation.id,
    anchor: annotation.anchor ?? missingAnchor(),
    anchorLabel: annotation.anchor ? anchorLabel(annotation.anchor) : MISSING_ANCHOR_LABEL,
    thread,
    ...(screenshotRef ? { screenshotRef } : {}),
  };
}

function missingAnchor(): Anchor {
  return { kind: 'page', url: MISSING_ANCHOR_URL };
}

/** A range of lines a commit touched in one file. */
export interface TouchedRange {
  path: string;
  startLine: number;
  endLine: number;
}

/** A commit summarized as the line ranges it changed. */
export interface CommitTouch {
  hash: string;
  ranges: TouchedRange[];
}

/** Whether a commit touched an annotation's anchored line. Only a `file_line`
 * anchor can be commit-touched; a `selector`/`page` anchor cannot (returns
 * false), so those resolve only via an explicit in-thread receipt. */
export function touchesAnchor(anchor: Anchor, commit: CommitTouch): boolean {
  if (anchor.kind !== 'file_line') return false;
  return commit.ranges.some(
    (range) =>
      range.path === anchor.path &&
      anchor.line >= range.startLine &&
      anchor.line <= range.endLine,
  );
}

/** Decide auto-resolution for an annotation when a commit lands (D6). Resolves
 * (idempotently) with a commit receipt when the commit touched the anchored
 * lines; otherwise leaves it unchanged. */
export function autoResolveOnCommit(
  annotation: Annotation,
  commit: CommitTouch,
): { resolved: boolean; resolution?: Resolution } {
  if (annotation.resolved) return { resolved: true, resolution: annotation.resolution };
  if (annotation.anchor && touchesAnchor(annotation.anchor, commit)) {
    return { resolved: true, resolution: { by: 'commit', receipt: commit.hash } };
  }
  return { resolved: false };
}
