// SOURCING: hand-roll; pure quote→offset+confidence scoring, kept dependency-free.
// Upstream that models robust quote anchoring: @apache-annotator/dom (W3C Web
// Annotation) and dom-anchor-text-quote + diff-match-patch. Not bound, on purpose:
// (1) @commonplace/coannotate is a deliberately ZERO-runtime-dependency core
// (package.json deps: {}) that eval-injects into arbitrary third-party pages via
// browse_with_me; pulling a dependency tree into other people's pages is a
// liability, not a convenience; (2) those libraries couple matching to a live DOM
// Range, which would destroy this package's headless (no-jsdom) testability; (3)
// parity with the sibling anchor-dom.ts, which already hand-rolls element
// anchoring for the same reasons. The DOM-Range binding (where apache-annotator
// would apply) is the separate quote-dom.ts, and even there we stay on native
// Range/TreeWalker platform APIs. This file is the pure algorithm only.
//
// Quote resolution for the margin-recall overlay (HANDOFF-MARGIN-RECALL D1/D3).
//
// The pure half of "resolve a text target to a position with a confidence": given
// the page's text and a W3C-style TextQuoteSelector (exact + optional prefix/
// suffix) plus an optional position hint, find the character range the quote
// occupies and how sure we are. It is the algorithm D1 (resolve text targets to
// rects) and D3 (re-anchor on revisit) both stand on, so it is unit-tested
// headlessly. Turning a returned offset range into viewport rects is the DOM half,
// in `quote-dom.ts`.
//
// Confidence is the re-anchor contract: an exact occurrence is 1.0; a fuzzy match
// carries its similarity in [0, 1). The CALLER owns the threshold below which a
// target becomes an orphan (the threshold is a product parameter per the spec),
// so this module never decides "orphan"; it only scores.

/** W3C TextQuoteSelector: the exact quote, with optional surrounding context that
 * disambiguates between repeated occurrences. */
export interface TextQuoteSelector {
  exact: string;
  prefix?: string;
  suffix?: string;
}

/** W3C TextPositionSelector: a character range in the page's text. Doubles as the
 * "position hint" D1 passes to prefer the occurrence nearest where it last was. */
export interface TextPositionSelector {
  start: number;
  end: number;
}

/** A resolved quote: the character range plus a confidence in [0, 1]. */
export interface QuoteMatch {
  start: number;
  end: number;
  confidence: number;
}

export interface MatchQuoteOptions {
  /** How far either side of the hint the fuzzy pass scans (chars). Bounds cost. */
  maxDrift?: number;
  /** Cap on windows the fuzzy pass evaluates when there is no hint. Bounds cost on
   * a whole-page scan. */
  maxScan?: number;
}

const DEFAULT_MAX_DRIFT = 512;
const DEFAULT_MAX_SCAN = 20_000;

/**
 * Resolve `quote` within `text`. Exact occurrences win (confidence 1.0),
 * disambiguated by prefix/suffix context and then by nearness to `hint`; when the
 * exact text is gone, a bounded fuzzy pass returns the closest window with its
 * similarity as the confidence. Returns `null` only when there is nothing to match
 * (empty quote or empty text).
 */
export function matchQuote(
  text: string,
  quote: TextQuoteSelector,
  hint?: TextPositionSelector,
  opts?: MatchQuoteOptions,
): QuoteMatch | null {
  const exact = quote.exact;
  if (!exact || text.length === 0) return null;

  const occurrences = allIndicesOf(text, exact);
  if (occurrences.length > 0) {
    const best = pickExactOccurrence(text, exact, occurrences, quote, hint);
    return { start: best, end: best + exact.length, confidence: 1 };
  }

  return fuzzyMatch(text, exact, hint, opts);
}

/** Every start index of `needle` in `haystack` (non-overlapping). */
function allIndicesOf(haystack: string, needle: string): number[] {
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const i = haystack.indexOf(needle, from);
    if (i === -1) break;
    out.push(i);
    from = i + needle.length;
  }
  return out;
}

/** Choose among exact occurrences: reward matching prefix/suffix context, then
 * prefer the one closest to the position hint. Any exact occurrence is a correct
 * re-anchor (it IS the quote); context/hint only pick WHICH. */
function pickExactOccurrence(
  text: string,
  exact: string,
  occurrences: number[],
  quote: TextQuoteSelector,
  hint?: TextPositionSelector,
): number {
  if (occurrences.length === 1) return occurrences[0];
  let best = occurrences[0];
  let bestScore = -Infinity;
  for (const i of occurrences) {
    let score = 0;
    if (quote.prefix) score += suffixOverlap(text.slice(0, i), quote.prefix);
    if (quote.suffix) score += prefixOverlap(text.slice(i + exact.length), quote.suffix);
    // Nearness to the hint is a gentle tiebreak, normalized so it never outweighs
    // a solid context match.
    if (hint) score += 1 - Math.min(1, Math.abs(i - hint.start) / Math.max(1, text.length));
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Length of the longest suffix of `before` that equals a prefix of `prefix`
 * (i.e. how much of the expected preceding context is actually present). */
function suffixOverlap(before: string, prefix: string): number {
  const max = Math.min(before.length, prefix.length);
  for (let n = max; n > 0; n -= 1) {
    if (before.endsWith(prefix.slice(prefix.length - n))) return n;
  }
  return 0;
}

/** Length of the longest prefix of `after` that equals a prefix of `suffix`. */
function prefixOverlap(after: string, suffix: string): number {
  const max = Math.min(after.length, suffix.length);
  for (let n = max; n > 0; n -= 1) {
    if (after.startsWith(suffix.slice(0, n))) return n;
  }
  return 0;
}

// ponytail: naive sliding-window Levenshtein similarity, O(windows·m²), bounded by
// maxDrift/maxScan. Correct for passage-sized quotes and cheap because it only runs
// when the exact text is gone. Upgrade path if fuzzy precision or huge quotes ever
// matter: Bitap / diff-match-patch match_main (what Hypothesis/obsidian-clipper use).
function fuzzyMatch(
  text: string,
  pattern: string,
  hint?: TextPositionSelector,
  opts?: MatchQuoteOptions,
): QuoteMatch | null {
  const m = pattern.length;
  if (m === 0 || m > text.length) {
    // The quote is longer than the whole document; score the whole document once.
    const sim = similarity(text, pattern);
    return { start: 0, end: text.length, confidence: sim };
  }

  const maxDrift = opts?.maxDrift ?? DEFAULT_MAX_DRIFT;
  const maxScan = opts?.maxScan ?? DEFAULT_MAX_SCAN;

  let lo = 0;
  let hi = text.length - m;
  if (hint) {
    lo = Math.max(0, hint.start - maxDrift);
    hi = Math.min(text.length - m, hint.start + maxDrift);
  } else if (hi - lo > maxScan) {
    hi = lo + maxScan;
  }

  let bestStart = lo;
  let bestSim = -1;
  for (let i = lo; i <= hi; i += 1) {
    const sim = similarity(text.slice(i, i + m), pattern);
    if (sim > bestSim) {
      bestSim = sim;
      bestStart = i;
      if (bestSim === 1) break; // can't beat an exact window
    }
  }
  return { start: bestStart, end: bestStart + m, confidence: Math.max(0, bestSim) };
}

/** Normalized similarity in [0, 1] = 1 − levenshtein / max(len). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/** A resolved position inside a run of text nodes: which node, and the offset
 * within it. */
export interface OffsetLocation {
  nodeIndex: number;
  offset: number;
}

/**
 * Map a global character offset onto a run of consecutive text nodes (given each
 * node's text length in document order). This is the arithmetic the DOM mount uses
 * to turn a `matchQuote` offset into a `Range` boundary; it is pure so the
 * off-by-one boundaries are tested here, not discovered in the browser. An offset
 * at a node seam resolves to the start of the following node, and anything past the
 * total clamps to the final node's end.
 */
export function locateOffset(nodeLengths: number[], offset: number): OffsetLocation {
  if (nodeLengths.length === 0) return { nodeIndex: 0, offset: 0 };
  const clamped = Math.max(0, offset);
  let acc = 0;
  for (let i = 0; i < nodeLengths.length; i += 1) {
    const len = nodeLengths[i];
    // `<` (not `<=`) so an offset exactly at a node seam resolves to the START of
    // the following node (offset 0), the correct collapsed boundary for both a range
    // start and end; the covered text is identical either way.
    if (clamped < acc + len) return { nodeIndex: i, offset: clamped - acc };
    acc += len;
  }
  const last = nodeLengths.length - 1;
  return { nodeIndex: last, offset: nodeLengths[last] };
}

/** Standard two-row Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}
