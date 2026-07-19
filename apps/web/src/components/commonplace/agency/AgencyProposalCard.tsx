'use client';

import type { AgencyAction, AgencyProposalModel } from '@/lib/agencyProposal';
import { WhyTrace } from './WhyTrace';
import styles from './agencyProposal.module.css';

export function AgencyProposalCard({
  proposal,
  onAction,
  onOpenEvidence,
}: {
  proposal: AgencyProposalModel;
  onAction?: (action: AgencyAction, proposal: AgencyProposalModel) => void;
  onOpenEvidence?: (proposal: AgencyProposalModel, reference: string) => void;
}) {
  const visibleArtifact = proposal.reversibility === 'visible_artifact';
  const expires = new Date(proposal.expiresAtMs).toLocaleString();

  return (
    <article className={styles.card} data-state={proposal.state}>
      <header className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>Proposal</span>
          <h2>{proposal.whatChanged}</h2>
        </div>
        <span className={styles.permission}>{proposal.permission.replaceAll('_', ' ')}</span>
      </header>
      <dl className={styles.summary}>
        <div><dt>Why it matters</dt><dd>{proposal.goalRefs.join(', ') || 'No goal reference supplied.'}</dd></div>
        <div><dt>Affected</dt><dd>{proposal.stakeRefs.join(', ') || 'No stake reference supplied.'}</dd></div>
        <div><dt>Prepared</dt><dd>{proposal.previewRef}</dd></div>
        <div><dt>Next</dt><dd>{proposal.actionClass} via {proposal.executorId}</dd></div>
        <div><dt>Reversibility</dt><dd>{proposal.reversibility.replaceAll('_', ' ')}</dd></div>
        <div><dt>Expires</dt><dd>{expires}</dd></div>
      </dl>
      {visibleArtifact ? (
        <div className={styles.disclosure}>
          {proposal.disclosures.map((disclosure) => <p key={disclosure.id}>{disclosure.text}</p>)}
        </div>
      ) : null}
      <WhyTrace proposal={proposal} onOpenEvidence={onOpenEvidence} />
      <div className={styles.actions} aria-label="Proposal controls">
        <button type="button" className={styles.approve} onClick={() => onAction?.('approve', proposal)}>Approve</button>
        <button type="button" onClick={() => onAction?.('edit', proposal)}>Edit</button>
        <button type="button" onClick={() => onAction?.('dismiss', proposal)}>Dismiss</button>
        <button type="button" onClick={() => onAction?.('suppress', proposal)}>Suppress</button>
      </div>
    </article>
  );
}
