// SOURCING: none. Pure mapping, mirroring apps/console/src/lib/degradation.ts
// rather than importing it: that module is 'use client' React-adjacent console
// code, and the pack runs in the extension host with no React present.
/**
 * Wire codes to sentences, and the loudness decision that goes with them.
 *
 * Wire codes never reach a reader. CS15's rule, carried into this surface. An
 * unmapped code takes the generic sentence and reports itself, so a new
 * server-side code shows up as a gap to close instead of as a leaked token.
 *
 * Two states this surface produces are routinely confused, and confusing them
 * is a product bug rather than a cosmetic one:
 *
 * - **Reduced.** The surface answered, and named an index it did not have.
 *   `degraded: true` with `missingIndexes: ["compute_code"]` is the *steady
 *   state* for a freshly mounted project — `editor_intelligence_acceptance.rs`
 *   asserts exactly that while tokens and fixes still come back. Rendering it
 *   as a warning pins a permanent alarm to a working editor, which trains the
 *   reader to ignore the one that matters.
 * - **Unavailable.** Nothing answered: the endpoint was unreachable, the
 *   response unreadable, or the query refused. There is no partial result to
 *   show and the reader needs to know their editor is not connected.
 *
 * Reduced is quiet. Unavailable is loud. An earlier build of this pack rendered
 * both as warnings with a `$(circle-slash)` chip, which would have shipped a
 * permanent error badge on a healthy install.
 */

import type { UnavailableSurface } from '@commonplace/block-view-contracts/editor-intelligence';
import type { ContentDrift } from '@commonplace/block-view-contracts/editor-offsets';

/** Index names the surface publishes in `missingIndexes`. */
const INDEX_SENTENCES: Record<string, string> = {
  compute_code: 'symbol resolution is still building',
  tree_sitter: 'syntax parsing is still building',
};

/** Transport, protocol, and refusal codes this pack produces. */
const UNAVAILABLE_SENTENCES: Record<string, string> = {
  editor_substrate_unreachable: 'Theorem is unreachable.',
  editor_substrate_unreadable: 'Theorem sent a response this build could not read.',
  editor_substrate_query_failed: 'The Theorem query could not complete.',
  editor_fix_unknown: 'That fix is no longer available.',
  editor_write_refused: 'The file changed since this edit was prepared.',
  editor_search_unavailable: 'Search over the index is unavailable; using ripgrep.',
  editor_seam_unavailable: 'The object seam is unavailable, so this document cannot be saved.',
  editor_object_missing: 'That object is not in the graph.',
  editor_history_unavailable: 'Local history is unavailable for this file.',
  editor_agent_unavailable: 'Theorem the agent is not reachable from this window.',
};

/** One index name, in words. Unknown names pass through rather than vanish. */
export function readableIndex(name: string): string {
  return INDEX_SENTENCES[name] ?? `${name} is still building`;
}

/**
 * What a reduced answer means, in words, or null when nothing is missing.
 *
 * Phrased as an ongoing activity rather than a fault, because that is what it
 * is: the surface is answering and an index is warming.
 */
export function readableReduced(missingIndexes: readonly string[]): string | null {
  if (missingIndexes.length === 0) return null;
  const parts = missingIndexes.map(readableIndex);
  if (parts.length === 1) return `Theorem: ${parts[0]}.`;
  return `Theorem: ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`;
}

/**
 * What an unanswered surface means, in words.
 *
 * `detail` carries the door and status; it belongs in a tooltip or the output
 * channel, never in the headline sentence.
 */
export function readableUnavailable(degradation: UnavailableSurface): string {
  return (
    UNAVAILABLE_SENTENCES[degradation.code]
    ?? (process.env.NODE_ENV === 'production'
      ? 'Theorem could not answer completely.'
      : `Theorem could not answer completely. (unmapped code: ${degradation.code})`)
  );
}

/** Detail line for tooltips and the output channel. Empty when there is none. */
export function degradationDetail(degradation: UnavailableSurface): string {
  return degradation.detail ?? '';
}

/**
 * Why findings were dropped for a file, in words.
 *
 * Drift is its own state and not an error: the surface answered correctly about
 * bytes the reader has since changed. Saying "findings are behind your edits"
 * is true and useful; drawing them against the current buffer would not be.
 */
export function readableDrift(drift: ContentDrift): string {
  return drift.kind === 'content_absent'
    ? 'Theorem: findings could not be placed, because the indexed text was not returned.'
    : 'Theorem: findings are behind your edits.';
}
