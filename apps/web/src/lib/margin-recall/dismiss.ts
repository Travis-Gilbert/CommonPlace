// SOURCING: none; the D6-4 dismiss logic (HANDOFF-MARGIN-RECALL). A page-scoped set of
// dismissed highlights plus the relevance-signal event a dismissal emits for telemetry. No
// upstream library models "hide a highlight for this page and record it as a relevance
// signal"; it is product policy, hand-written and node-tested (the same shape as hold.ts).
// Carries no DOM and no network: the caller ships the emitted signal to telemetry.

import type { SalienceTier } from './select';

export interface DismissState {
  /** Candidate ids dismissed on the current page. */
  dismissed: ReadonlySet<string>;
}

/** The relevance signal a dismissal emits (D6-4: "dismissals land in telemetry"). */
export interface DismissSignal {
  kind: 'margin_recall.dismiss';
  id: string;
  tier: SalienceTier;
  /** The page the dismissal happened on (content hash), so the signal is page-scoped. */
  page: string;
  score: number;
}

export const EMPTY_DISMISS_STATE: DismissState = { dismissed: new Set() };

/**
 * Dismiss a highlight: add it to the page's dismissed set (idempotent) and emit the relevance
 * signal. A re-dismiss of an already-dismissed id changes nothing and emits no new signal, so
 * telemetry never double-counts. The overlay drops any id in the returned set (D6-4: "hides the
 * highlight for this page").
 */
export function dismissHighlight(
  state: DismissState,
  candidate: { id: string; tier: SalienceTier; score: number },
  page: string,
): { state: DismissState; signal: DismissSignal | null } {
  if (state.dismissed.has(candidate.id)) {
    return { state, signal: null };
  }
  const dismissed = new Set(state.dismissed);
  dismissed.add(candidate.id);
  return {
    state: { dismissed },
    signal: {
      kind: 'margin_recall.dismiss',
      id: candidate.id,
      tier: candidate.tier,
      page,
      score: candidate.score,
    },
  };
}

/** Whether a highlight is dismissed on this page, so the overlay filters it out. */
export function isDismissed(state: DismissState, id: string): boolean {
  return state.dismissed.has(id);
}

/** Reset dismissals on navigation: dismissals are per-page, so a new page starts clean. */
export function resetDismissals(): DismissState {
  return { dismissed: new Set() };
}
