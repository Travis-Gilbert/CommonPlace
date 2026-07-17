// SOURCING: none; pure placement logic composing @commonplace/coannotate (quote to
// rects, type-only here) and ./select (rank, cap, orphan drop). No upstream component
// models "salience candidates to a budgeted, ranked, positioned highlight set"; it is
// product policy over the coannotate geometry contract, so it stays hand-written and
// node-tested. The coannotate import is type-only, so this module carries no DOM and
// runs in the node vitest harness (the resolver is injected).
//
// The pure half of the D4 highlight overlay (HANDOFF-MARGIN-RECALL D4): given salience
// candidates and a quote resolver, decide WHAT to paint and WHERE. The React mount
// (MarginOverlay.tsx) only paints what this returns.

import type { Rect, TextPositionSelector, TextQuoteSelector } from '@commonplace/coannotate';
import { selectHighlights, type SalienceTier } from './select';

/** A salience candidate as the overlay consumes it: the D2 SalienceCandidate projected
 * to what placement needs, a quote anchor plus its tier, strength, and the connection
 * text revealed on hover/expand (D5/D6). */
export interface MarginCandidate {
  id: string;
  quote: TextQuoteSelector;
  /** Where the quote last resolved, to prefer the nearest occurrence (D1 positionHint). */
  hint?: TextPositionSelector;
  tier: SalienceTier;
  score: number;
  explanation: string;
}

/** A candidate resolved to pixels and kept for painting. */
export interface PlacedHighlight {
  id: string;
  candidate: MarginCandidate;
  tier: SalienceTier;
  /** One rect per visual line the quote occupies. */
  rects: Rect[];
  /** Anchor re-resolution confidence (1 = exact match). */
  confidence: number;
}

/** Resolve a quote to rects plus confidence. In the browser this is
 * `(q, h) => resolveQuoteRectsInRoot(root, q, h)`; in tests it is a stub, which is why
 * placement stays DOM-free and node-testable. */
export type QuoteResolver = (
  quote: TextQuoteSelector,
  hint: TextPositionSelector | undefined,
) => { rects: Rect[]; confidence: number };

export interface PlaceOptions {
  /** Max highlights painted on one page (the spec budget is 5). */
  budget?: number;
  /** Below this re-resolution confidence a target is an orphan (D3): never painted,
   * shown only in the collapsed session list. */
  minConfidence?: number;
}

const DEFAULT_BUDGET = 5;
const DEFAULT_MIN_CONFIDENCE = 0.5;

/**
 * Turn salience candidates into the highlights to paint. Resolve each quote to rects,
 * drop any with nothing visible to paint, then rank exact tier before semantic and
 * higher score first, capping at budget and excluding orphans (confidence below
 * minConfidence). Pure and resolver-injected, so it is unit-tested without a DOM.
 */
export function placeHighlights(
  candidates: readonly MarginCandidate[],
  resolve: QuoteResolver,
  opts: PlaceOptions = {},
): PlacedHighlight[] {
  const budget = opts.budget ?? DEFAULT_BUDGET;
  const minConfidence = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  const resolved = candidates
    .map((candidate) => {
      const { rects, confidence } = resolve(candidate.quote, candidate.hint);
      return { candidate, rects, confidence };
    })
    .filter((entry) => entry.rects.length > 0); // nothing visible to paint is not a highlight

  const selected = selectHighlights(
    resolved.map((entry) => ({
      tier: entry.candidate.tier,
      score: entry.candidate.score,
      confidence: entry.confidence,
      ref: entry,
    })),
    { budget, minConfidence },
  );

  return selected.map((entry) => ({
    id: entry.ref.candidate.id,
    candidate: entry.ref.candidate,
    tier: entry.ref.candidate.tier,
    rects: entry.ref.rects,
    confidence: entry.ref.confidence,
  }));
}

/**
 * Intersect a rect with a bounds rect, or null when they do not overlap. The overlay
 * clips every mark to the reader's visible box so a passage scrolled out of the content
 * viewport never paints a stray tint over the surrounding chrome. Pure geometry, tested
 * here rather than eyeballed in the browser.
 */
export function clipRect(rect: Rect, bounds: Rect): Rect | null {
  const x1 = Math.max(rect.x, bounds.x);
  const y1 = Math.max(rect.y, bounds.y);
  const x2 = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const y2 = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
