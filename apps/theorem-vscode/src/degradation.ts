// SOURCING: none. Pure mapping, mirroring apps/console/src/lib/degradation.ts
// rather than importing it: that module is 'use client' React-adjacent console
// code, and the pack runs in the extension host with no React present.
/**
 * Wire codes never reach a reader. CS15's rule, carried into this surface.
 *
 * An unmapped code takes the generic sentence and reports itself, so a new
 * server-side code shows up as a gap to close instead of as a leaked token.
 */

import type { IntelligenceDegradation } from '@commonplace/block-view-contracts/editor-intelligence';

const SENTENCES: Record<string, string> = {
  editor_substrate_unreachable: 'Theorem is unreachable.',
  editor_substrate_unreadable: 'Theorem sent a response this build could not read.',
  editor_substrate_query_failed: 'The Theorem query could not complete.',
  editor_index_cold: 'Theorem is still building its indexes.',
  editor_fix_unknown: 'That fix is no longer available.',
  editor_search_degraded: 'Search answered from part of the index.',
  editor_search_unavailable: 'Search over the index is unavailable; using ripgrep.',
  editor_seam_unavailable: 'The object seam is unavailable, so this document cannot be saved.',
  editor_object_missing: 'That object is not in the graph.',
  editor_history_unavailable: 'Local history is unavailable for this file.',
  editor_agent_unavailable: 'Theorem the agent is not reachable from this window.',
};

/**
 * One sentence a reader can act on, with the missing pieces named and the
 * evidence kept beside it. `detail` carries the door and status; it belongs in
 * a tooltip or log, never in the headline sentence.
 */
export function readableDegradation(degradation: IntelligenceDegradation): string {
  const sentence =
    SENTENCES[degradation.code] ??
    (process.env.NODE_ENV === 'production'
      ? 'Theorem could not answer completely.'
      : `Theorem could not answer completely. (unmapped code: ${degradation.code})`);

  if (degradation.missing?.length) {
    return `${sentence} Missing: ${degradation.missing.join(', ')}.`;
  }
  return sentence;
}

/** Detail line for tooltips and the output channel. Empty when there is none. */
export function degradationDetail(degradation: IntelligenceDegradation): string {
  return degradation.detail ?? '';
}
