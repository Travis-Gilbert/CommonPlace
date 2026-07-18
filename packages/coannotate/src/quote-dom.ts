// SOURCING: none; native DOM Range + TreeWalker platform APIs. The upstream that
// models quote->Range anchoring is @apache-annotator/dom (W3C Web Annotation); it is
// declined for the reasons in text-quote.ts's header (a zero-runtime-dependency core
// that eval-injects into third-party pages; DOM-Range coupling would break the
// package's headless testability). This file is only the thin DOM glue over that pure
// matcher, and, like anchor-dom.ts, works through NARROW DOM interfaces a real
// browser satisfies structurally, plus injected factories, so it runs in the page AND
// is testable with a small fake (no jsdom).
//
// The DOM half of HANDOFF-MARGIN-RECALL D1 (`resolveTextTargets`): turn a resolved
// text quote into the viewport rects it occupies, so the overlay tints exactly the
// matched passage. A quote that wraps across lines yields ONE rect per line, straight
// from `Range.getClientRects()`, which is why the return is a `Rect[]` not a single
// box. The pure "which character range does the quote occupy" half is text-quote.ts;
// this is "which pixels is that range", the only part that needs a live layout.

import { locateOffset, matchQuote } from './text-quote.ts';
import type {
  MatchQuoteOptions,
  QuoteMatch,
  TextPositionSelector,
  TextQuoteSelector,
} from './text-quote.ts';
import type { Rect } from './types.ts';

/** The subset of a DOM text node this module needs: its text. A real `Text` satisfies
 * it, and the node is otherwise opaque; it is only handed back to a `RangeLike`. */
export interface TextNodeLike {
  readonly textContent: string | null;
}

/** A DOM `Range`, narrowed to what rect resolution uses. A real `Range` is
 * structurally assignable (its `getClientRects()` returns a `DOMRectList` whose
 * `DOMRect`s are `Rect`s). Injected as a factory so the glue is testable without a
 * browser: pass `() => document.createRange()` in the page, a fake in the check. */
export interface RangeLike {
  setStart(node: TextNodeLike, offset: number): void;
  setEnd(node: TextNodeLike, offset: number): void;
  getClientRects(): ArrayLike<Rect>;
}

/** A run of consecutive text nodes flattened for matching: the nodes in document
 * order, each node's text length, and their concatenation (what `matchQuote` scans).
 * The three arrays/strings stay index-aligned so an offset into `text` maps back onto
 * a node via `lengths`. */
export interface TextRun {
  nodes: TextNodeLike[];
  lengths: number[];
  text: string;
}

/** Flatten text nodes (document order) into a `TextRun`. Pure: the browser builds the
 * node list with a `TreeWalker` (`browserTextNodes`); this is the testable seam. */
export function collectTextRun(nodes: TextNodeLike[]): TextRun {
  const texts = nodes.map((n) => n.textContent ?? '');
  return {
    nodes,
    lengths: texts.map((t) => t.length),
    text: texts.join(''),
  };
}

/**
 * The pixels a resolved match occupies. Maps the match's character offsets onto text
 * nodes (`locateOffset`), sets a `Range` across them, and returns its client rects,
 * one per visual line, dropping zero-area rects so the overlay tints only inked
 * lines, never a collapsed seam. Returns `[]` for an empty run.
 */
export function rectsForMatch(run: TextRun, match: QuoteMatch, range: RangeLike): Rect[] {
  if (run.nodes.length === 0) return [];
  const start = locateOffset(run.lengths, match.start);
  const end = locateOffset(run.lengths, match.end);
  range.setStart(run.nodes[start.nodeIndex], start.offset);
  range.setEnd(run.nodes[end.nodeIndex], end.offset);

  const rects = range.getClientRects();
  const out: Rect[] = [];
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (r.width > 0 && r.height > 0) {
      out.push({ x: r.x, y: r.y, width: r.width, height: r.height });
    }
  }
  return out;
}

/** A resolved text target: the rects to tint and the match confidence the caller
 * thresholds (an exact match is 1; below the product threshold it is an orphan and
 * the caller renders nothing). */
export interface ResolvedRects {
  rects: Rect[];
  confidence: number;
}

/**
 * Resolve a quote to its viewport rects over an already-collected run of text nodes.
 * Composes the pure matcher with the DOM glue: no match text at all -> no rects,
 * confidence 0; otherwise the best occurrence's rects with its confidence. `hint`
 * biases toward the occurrence nearest where the quote last resolved (D1 positionHint,
 * D3 re-anchor).
 */
export function resolveTextRects(
  nodes: TextNodeLike[],
  quote: TextQuoteSelector,
  hint: TextPositionSelector | undefined,
  makeRange: () => RangeLike,
  opts?: MatchQuoteOptions,
): ResolvedRects {
  const run = collectTextRun(nodes);
  const match = matchQuote(run.text, quote, hint, opts);
  if (!match) return { rects: [], confidence: 0 };
  return { rects: rectsForMatch(run, match, makeRange()), confidence: match.confidence };
}

// --- Browser adapters (exercised in the page, not the headless check) ---
// These are the two-line bindings to the real platform that `resolveTextRects` is
// abstracted over. They use lib.dom types (so `tsc` covers them) but are trivial
// enough that the browser is their test surface.

/** Collect the text nodes under `root` in document order; the browser's `TextRun`
 * input. A `TreeWalker` over `SHOW_TEXT` is exactly document order. */
export function browserTextNodes(root: Node): Text[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    out.push(n as Text);
  }
  return out;
}

/**
 * One-call browser entry: resolve a quote to viewport rects within a root element,
 * using the live DOM. `Range.getClientRects()` is already viewport-relative, matching
 * `Rect`'s contract, so these rects drop straight into the overlay's positioning.
 */
export function resolveQuoteRectsInRoot(
  root: Element,
  quote: TextQuoteSelector,
  hint?: TextPositionSelector,
  opts?: MatchQuoteOptions,
): ResolvedRects {
  const doc = root.ownerDocument;
  return resolveTextRects(browserTextNodes(root), quote, hint, () => doc.createRange(), opts);
}
