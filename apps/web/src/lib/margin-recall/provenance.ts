// SOURCING: none; the D6-2 provenance projection (HANDOFF-MARGIN-RECALL). Shapes the openable
// connection chain a short click reveals, from a salience candidate. No upstream library models
// "project a scored page connection into what it links to, why, and how it was drawn"; it is
// product policy over our own MarginCandidate, hand-written and node-tested. Carries no DOM and
// no network: the mount opens each record (ReceiptRail pattern) via a callback.
//
// Honest scope: `what` (the openable records) and `why` (the explanation + evidence path) come
// straight off the candidate. The `when` the spec also names lives on the referenced record, so
// it arrives with the record the mount fetches, not from this projection.

import type { SalienceTier } from './select';

/** The minimum a connection needs to explain itself. Both the overlay's MarginCandidate and a
 * placed MarginNote satisfy this structurally, so the projection couples to neither. */
export interface ConnectionSource {
  explanation: string;
  tier: SalienceTier;
  refs?: string[];
}

export interface ConnectionProvenance {
  /** Why the connection was drawn: the pipeline's explanation. */
  why: string;
  /** Which tier surfaced it, the confidence read. */
  tier: SalienceTier;
  /** How it was drawn, in plain words: the tier's evidence path. */
  basis: string;
  /** The stored records this passage connects to, strongest first: the openable chain. */
  records: string[];
  /** Whether there is anything openable to show. */
  hasChain: boolean;
}

/** Plain-words evidence path per tier, so the panel says how the connection was reached rather
 * than only asserting it. */
function basisFor(tier: SalienceTier): string {
  return tier === 'exact'
    ? 'This page names a record in your library.'
    : 'This passage reads close to a saved note.';
}

/**
 * Project a candidate into its full connection (D6-2): what it links to, why, and how it was
 * drawn. A candidate with no linked records yields `hasChain: false`, so the panel renders an
 * honest empty state instead of an openable chain that goes nowhere.
 */
export function connectionProvenance(candidate: ConnectionSource): ConnectionProvenance {
  const records = candidate.refs ?? [];
  return {
    why: candidate.explanation,
    tier: candidate.tier,
    basis: basisFor(candidate.tier),
    records,
    hasChain: records.length > 0,
  };
}
