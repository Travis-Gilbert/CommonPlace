'use client';

/**
 * Perception cards (HANDOFF-COBROWSE-PRESENCE D7): the three-card replacement
 * for the old JSON dump. What I see (observations), What I can do here
 * (affordances), Suggested next (the held proposal or the top ready rail
 * action, one press, routed through the approval card when confirm-gated).
 * All five view states render through ViewStateView; the loading branch uses
 * the wait-tier ladder with the coBrowseAction narration.
 */

import type { BrowsePerception, RailAction } from '@/lib/desktop';
import { proposedActionOf } from '@/lib/desktop';
import type { ViewState } from '@/lib/commonplace-view-state';
import { narrationFor } from '@/lib/commonplace-wait-narration';
import ViewStateView from '@/components/commonplace/shared/ViewStateView';
import styles from './cobrowse.module.css';

function readyActions(perception: BrowsePerception): RailAction[] {
  return perception.action_rail.actions.filter(
    (action) => action.status === 'ready' || action.status === 'needs_confirmation',
  );
}

export function PerceptionCards({
  state,
  onRunSuggested,
}: {
  state: ViewState<BrowsePerception>;
  onRunSuggested: () => void;
}) {
  return (
    <ViewStateView
      state={state}
      label="Perception"
      narration={narrationFor('coBrowseAction', 1)}
      empty={
        <div className={styles.card}>
          <div className={styles.cardTitle}>Perception</div>
          <div className={styles.cardDim}>
            No co-browse session yet. Open a page and give the agent a task.
          </div>
        </div>
      }
    >
      {(perception, partial) => {
        const proposal = proposedActionOf(perception);
        const affordances = readyActions(perception);
        const suggested = proposal
          ? null
          : affordances.find((action) => action.status === 'ready') ?? null;
        return (
          <div className={styles.cards} aria-busy={partial}>
            <section className={styles.card} aria-label="What I see">
              <div className={styles.cardTitle}>What I see</div>
              {perception.live_browser ? (
                <div className={styles.cardRow}>
                  <span>{perception.live_browser.page.title || perception.live_browser.page.url}</span>
                </div>
              ) : null}
              {perception.perception.candidates.length === 0 ? (
                <div className={styles.cardDim}>Nothing observed on this page yet.</div>
              ) : (
                perception.perception.candidates.slice(0, 6).map((candidate) => (
                  <div key={candidate.id} className={styles.cardRow}>
                    <span>{candidate.label}</span>
                    <span className={styles.cardDim}>{candidate.kind}</span>
                  </div>
                ))
              )}
            </section>
            <section className={styles.card} aria-label="What I can do here">
              <div className={styles.cardTitle}>What I can do here</div>
              {affordances.length === 0 ? (
                <div className={styles.cardDim}>No affordances on this page yet.</div>
              ) : (
                affordances.slice(0, 6).map((action) => (
                  <div key={action.id} className={styles.cardRow}>
                    <span>{action.label}</span>
                    {action.status === 'needs_confirmation' ? (
                      <span className={styles.cardDim}>asks first</span>
                    ) : null}
                  </div>
                ))
              )}
            </section>
            <section className={styles.card} aria-label="Suggested next">
              <div className={styles.cardTitle}>Suggested next</div>
              {proposal ? (
                <>
                  <div className={styles.cardRow}>
                    <span>{proposal.intent || `${proposal.verb} on ${proposal.targetDescriptor}`}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.doItButton}
                    onPointerDown={onRunSuggested}
                  >
                    Do it
                  </button>
                </>
              ) : suggested ? (
                <>
                  <div className={styles.cardRow}>
                    <span>{suggested.label}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.doItButton}
                    onPointerDown={onRunSuggested}
                  >
                    Do it
                  </button>
                </>
              ) : (
                <div className={styles.cardDim}>Nothing proposed right now.</div>
              )}
            </section>
          </div>
        );
      }}
    </ViewStateView>
  );
}
