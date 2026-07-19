'use client';

import { useState } from 'react';
import type { ViewState } from '@/lib/commonplace-view-state';
import type { AgencyAction, AgencyProposalModel } from '@/lib/agencyProposal';
import { AgencyProposalCard } from './AgencyProposalCard';
import styles from './agencyProposal.module.css';

export function AgencyProposalRegistry({
  state,
  onRetry,
  onAction,
  onOpenEvidence,
}: {
  state: ViewState<AgencyProposalModel[]>;
  onRetry?: () => void;
  onAction?: (action: AgencyAction, proposal: AgencyProposalModel) => void;
  onOpenEvidence?: (proposal: AgencyProposalModel, reference: string) => void;
}) {
  const [everythingElse, setEverythingElse] = useState(false);

  if (state.status === 'loading') {
    return <LoadingState />;
  }
  if (state.status === 'error') {
    return (
      <section className={styles.stateCard} data-state="error">
        <h1>Proposals are unavailable</h1>
        <p>{state.message}</p>
        {onRetry ? <button type="button" onClick={onRetry}>Try again</button> : null}
      </section>
    );
  }
  if (state.status === 'empty') {
    return (
      <section className={styles.stateCard} data-state="empty">
        <h1>Nothing needs your attention</h1>
        <p>No grounded, actionable proposal is waiting for review.</p>
      </section>
    );
  }

  const cards = state.data.slice(0, 7);
  const remaining = state.data.slice(7);
  return (
    <section className={styles.registry} aria-busy={state.status === 'partial'}>
      <header className={styles.registryHeader}>
        <div>
          <span className={styles.eyebrow}>Agency proposals</span>
          <h1>Prepared work, awaiting your decision</h1>
        </div>
        {state.status === 'partial' ? <span className={styles.partial}>Refreshing the remaining proposals</span> : null}
      </header>
      {cards.map((proposal) => (
        <AgencyProposalCard
          key={proposal.id}
          proposal={proposal}
          onAction={onAction}
          onOpenEvidence={onOpenEvidence}
        />
      ))}
      {remaining.length ? (
        <div className={styles.everythingElse}>
          <button type="button" onClick={() => setEverythingElse((current) => !current)}>
            {everythingElse ? 'Hide everything else' : `Everything else (${remaining.length})`}
          </button>
          {everythingElse ? remaining.map((proposal) => <AgencyProposalCard key={proposal.id} proposal={proposal} onAction={onAction} onOpenEvidence={onOpenEvidence} />) : null}
        </div>
      ) : null}
    </section>
  );
}

function LoadingState() {
  return (
    <section className={styles.stateCard} data-state="loading" aria-live="polite">
      <span className={styles.eyebrow}>Agency proposals</span>
      <h1>Checking prepared work</h1>
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
    </section>
  );
}
