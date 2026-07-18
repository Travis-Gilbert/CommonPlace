// SOURCING: none; pure re-anchor decision composing ./text-quote (matchQuote). No
// upstream component models the "unchanged hash reuses, changed content re-resolves by
// quote, below confidence is an orphan" policy; it is the D3 durability contract for
// HANDOFF-MARGIN-RECALL, and it is pure over the page's text so it is unit-tested
// headlessly. Turning the returned position into viewport rects is quote-dom.ts.
//
// The one hard guarantee: a highlight is NEVER placed on text the stored quote does not
// actually match. A revisit either lands exactly (identical page), re-resolves with a
// confidence the caller can trust, or becomes an orphan shown only in the session list.

import { matchQuote } from './text-quote.ts';
import type { TextPositionSelector, TextQuoteSelector } from './text-quote.ts';

/** A stored text target: the W3C-style quote + position, plus the page content hash it
 * was captured against (BLAKE3, per D1 pageIdentity). Mirrors the persisted
 * `text_quote` Anchor. */
export interface StoredTextAnchor {
  quote: TextQuoteSelector;
  position?: TextPositionSelector;
  contentHash: string;
}

/** The page as it is on this visit: its text and its current content hash. */
export interface CurrentPage {
  text: string;
  contentHash: string;
}

/**
 * The re-anchor result:
 * - `unchanged`: the page hash is identical, so the stored position is still exact.
 * - `moved`: the content changed but the quote re-resolved at or above the threshold.
 * - `orphan`: the quote could not be re-resolved with enough confidence; do not paint.
 */
export type ReanchorOutcome =
  | { status: 'unchanged'; position: TextPositionSelector; confidence: 1 }
  | { status: 'moved'; position: TextPositionSelector; confidence: number }
  | { status: 'orphan'; confidence: number };

export interface ReanchorOptions {
  /** Below this re-resolution confidence the target is an orphan (never highlighted). */
  minConfidence?: number;
}

const DEFAULT_MIN_CONFIDENCE = 0.5;

/**
 * Re-anchor a stored text target against the page as it is now. The identical-hash fast
 * path reuses the stored position with no scan (D2's cache guarantee and the common
 * revisit). Otherwise the quote is re-resolved, biased toward where it last sat, and the
 * match is accepted only at or above `minConfidence`; anything below is an orphan so a
 * highlight never drifts onto the wrong passage.
 */
export function reanchorText(
  stored: StoredTextAnchor,
  current: CurrentPage,
  opts: ReanchorOptions = {},
): ReanchorOutcome {
  const minConfidence = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  if (stored.position && stored.contentHash === current.contentHash) {
    return { status: 'unchanged', position: stored.position, confidence: 1 };
  }

  const match = matchQuote(current.text, stored.quote, stored.position);
  if (!match || match.confidence < minConfidence) {
    return { status: 'orphan', confidence: match ? match.confidence : 0 };
  }
  return {
    status: 'moved',
    position: { start: match.start, end: match.end },
    confidence: match.confidence,
  };
}
