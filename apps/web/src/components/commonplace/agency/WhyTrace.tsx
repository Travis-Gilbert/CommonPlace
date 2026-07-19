'use client';

import { useState } from 'react';
import type { AgencyProposalModel } from '@/lib/agencyProposal';
import styles from './agencyProposal.module.css';

export function WhyTrace({
  proposal,
  onOpenEvidence,
  initiallyOpen = false,
}: {
  proposal: AgencyProposalModel;
  onOpenEvidence?: (proposal: AgencyProposalModel, reference: string) => void;
  /** Used by durable record views and fixture coverage; interactive cards start collapsed. */
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <section className={styles.whyTrace} aria-label={`Why ${proposal.id} is proposed`}>
      <button
        type="button"
        className={styles.whyToggle}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Hide why' : 'Show why'}
      </button>
      {open ? (
        <div className={styles.whyBody}>
          <TraceGroup proposal={proposal} label="Supporting evidence" references={proposal.evidenceRefs} onOpenEvidence={onOpenEvidence} />
          <TraceGroup proposal={proposal} label="Disagreeing evidence" references={proposal.counterEvidenceRefs} onOpenEvidence={onOpenEvidence} empty="No disagreement was recorded." />
          <TraceGroup proposal={proposal} label="Verifier or solver receipts" references={proposal.verifierReceiptRefs} onOpenEvidence={onOpenEvidence} />
          <div className={styles.traceGroup}>
            <span className={styles.traceLabel}>Assumptions</span>
            {proposal.assumptionEnvironments.length ? (
              <ul className={styles.assumptionList}>
                {proposal.assumptionEnvironments.map((environment, index) => (
                  <li key={`${proposal.id}:assumption:${index}`}>{environment.join(' and ')}</li>
                ))}
              </ul>
            ) : (
              <span className={styles.traceEmpty}>No assumption environment was retained.</span>
            )}
            {!proposal.assumptionLabelComplete ? (
              <span className={styles.frontierNote}>
                Within the explored frontier; this is a bounded, non-exhaustive label.
              </span>
            ) : null}
          </div>
          <div className={styles.acceptanceLine}>
            Acceptance is bound to the exact effect contract and fresh preconditions, not this explanation alone.
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TraceGroup({
  proposal,
  label,
  references,
  onOpenEvidence,
  empty = 'None recorded.',
}: {
  proposal: AgencyProposalModel;
  label: string;
  references: string[];
  onOpenEvidence?: (proposal: AgencyProposalModel, reference: string) => void;
  empty?: string;
}) {
  return (
    <div className={styles.traceGroup}>
      <span className={styles.traceLabel}>{label}</span>
      {references.length ? (
        <div className={styles.chips}>
          {references.map((reference) => (
            <button
              key={reference}
              type="button"
              className={styles.evidenceChip}
              onClick={() => onOpenEvidence?.(proposal, reference)}
            >
              {reference}
            </button>
          ))}
        </div>
      ) : (
        <span className={styles.traceEmpty}>{empty}</span>
      )}
    </div>
  );
}
