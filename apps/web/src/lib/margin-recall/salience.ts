// SOURCING: none; the TS half of the D2 salience wire contract (HANDOFF-MARGIN-RECALL).
// No upstream library models "a node-scored page connection projected to a budgeted
// margin highlight"; this is product policy over our own Rust `salience.rs` serde shape,
// so it is a hand-written parity type plus a defensive decoder. The anchor reuses
// coannotate's TextQuoteSelector / TextPositionSelector verbatim, so a candidate the node
// emits and a candidate the overlay resolves are the same geometry. Pure and node-tested;
// carries no DOM and no network (the caller supplies the JSON, the test supplies a fixture).
//
// This is the seam the D4 overlay consumes: SalienceCandidate (wire) -> MarginCandidate
// (what placeHighlights ranks and paints).

import type { TextPositionSelector, TextQuoteSelector } from '@commonplace/coannotate';
import type { SalienceTier } from './select';
import type { MarginCandidate } from './overlay-model';

/** The anchor as the node emits it: a W3C text quote plus the character range it resolved
 * at. The quote is authoritative; the position is the re-anchor hint (D3-3). Parity with
 * the Rust `SalienceAnchor`. */
export interface SalienceAnchor {
  quote: TextQuoteSelector;
  position: TextPositionSelector;
}

/** One proposed margin-recall highlight from the salience pipeline. Parity with the Rust
 * `SalienceCandidate` serde shape: snake-free field names, `tier` as the lowercase union,
 * `refs` the openable provenance records (omitted when empty on the wire). */
export interface SalienceCandidate {
  anchor: SalienceAnchor;
  tier: SalienceTier;
  explanation: string;
  score: number;
  refs: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseQuote(value: unknown): TextQuoteSelector | null {
  if (!isRecord(value) || typeof value.exact !== 'string') return null;
  const quote: TextQuoteSelector = { exact: value.exact };
  if (typeof value.prefix === 'string') quote.prefix = value.prefix;
  if (typeof value.suffix === 'string') quote.suffix = value.suffix;
  return quote;
}

function parsePosition(value: unknown): TextPositionSelector | null {
  if (!isRecord(value)) return null;
  const { start, end } = value;
  if (typeof start !== 'number' || typeof end !== 'number') return null;
  return { start, end };
}

/** Decode one wire candidate, returning null on any shape mismatch rather than throwing, so
 * a single malformed record never blanks the whole overlay. `refs` defaults to [] (the Rust
 * side omits it when empty). */
export function parseSalienceCandidate(value: unknown): SalienceCandidate | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.anchor)) return null;
  const quote = parseQuote(value.anchor.quote);
  const position = parsePosition(value.anchor.position);
  if (!quote || !position) return null;
  if (value.tier !== 'exact' && value.tier !== 'semantic') return null;
  if (typeof value.explanation !== 'string') return null;
  if (typeof value.score !== 'number') return null;
  const refs = Array.isArray(value.refs)
    ? value.refs.filter((ref): ref is string => typeof ref === 'string')
    : [];
  return {
    anchor: { quote, position },
    tier: value.tier,
    explanation: value.explanation,
    score: value.score,
    refs,
  };
}

/** Decode a wire list, dropping any malformed entry. */
export function parseSalienceCandidates(value: unknown): SalienceCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseSalienceCandidate)
    .filter((candidate): candidate is SalienceCandidate => candidate !== null);
}

/** A stable overlay id for a candidate: its strongest connected record (when any) plus the
 * resolved span, so the same page connection keeps its identity across a re-resolve and the
 * React key never collides between two candidates on one page. */
export function salienceCandidateId(candidate: SalienceCandidate): string {
  const record = candidate.refs[0] ?? 'salience';
  return `${record}:${candidate.anchor.position.start}-${candidate.anchor.position.end}`;
}

/** Project a wire candidate to what the D4 overlay consumes: the quote, its position as the
 * resolve hint, tier, score, the connection text shown on hover/expand, and the openable
 * record chain a short click reveals (D6-2). */
export function salienceToMarginCandidate(candidate: SalienceCandidate): MarginCandidate {
  return {
    id: salienceCandidateId(candidate),
    quote: candidate.anchor.quote,
    hint: candidate.anchor.position,
    tier: candidate.tier,
    score: candidate.score,
    explanation: candidate.explanation,
    refs: candidate.refs,
  };
}

/** Convenience: parse a raw wire payload straight into overlay candidates. */
export function marginCandidatesFromWire(value: unknown): MarginCandidate[] {
  return parseSalienceCandidates(value).map(salienceToMarginCandidate);
}
