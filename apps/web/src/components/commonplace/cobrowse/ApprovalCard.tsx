'use client';

/**
 * Approval card (HANDOFF-COBROWSE-PRESENCE D5). Renders when a held action is
 * confirm-gated: what the agent wants to do, why (the node-resolved intent
 * plus the affordance being exercised), and blast radius (site, data written,
 * anything leaving the page). Enter approves, Escape declines; both have
 * visible button equivalents. Oxblood register: this is a pending decision.
 * On decline the engine's veto branch clears the held action and the session
 * continues; the run never terminates here.
 */

import { useEffect } from 'react';
import type { ProposedAction, BrowsePerception } from '@/lib/desktop';
import styles from './cobrowse.module.css';

const WRITE_VERBS = new Set(['fill', 'select_option', 'set_checked', 'check', 'set_input_files']);

export function ApprovalCard({
  proposal,
  perception,
  onApprove,
  onDecline,
}: {
  proposal: ProposedAction;
  perception: BrowsePerception | null;
  onApprove: () => void;
  onDecline: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onApprove();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onDecline();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onApprove, onDecline]);

  const page = perception?.live_browser?.page;
  const site = ((): string => {
    // The engine can return a malformed or empty url; a bad parse must not crash
    // the approval UI, so it falls back to a generic label.
    if (!page?.url) return 'this page';
    try {
      return new URL(page.url).hostname;
    } catch {
      return 'this page';
    }
  })();
  const writesData = WRITE_VERBS.has(proposal.verb);
  const affordance = perception?.action_rail.actions.find(
    (action) => action.status === 'needs_confirmation',
  );

  return (
    <div className={styles.approvalCard} role="alertdialog" aria-label="Approval required">
      <div className={styles.approvalHeading}>The agent wants to act</div>
      <div className={styles.approvalSection}>
        <span className={styles.approvalKey}>What</span>
        <span>{proposal.intent || `${proposal.verb} on ${proposal.targetDescriptor}`}</span>
        <span className={styles.approvalKey}>Why</span>
        <span>
          {affordance
            ? `${proposal.intent ? `${proposal.intent}; ` : ''}exercising: ${affordance.label}`
            : proposal.intent || `The next step of the current task uses ${proposal.targetDescriptor}.`}
        </span>
        <span className={styles.approvalKey}>Blast radius</span>
        <span>
          {site}
          {writesData ? '; writes data into the page' : '; no data written'}
          {'; nothing leaves the page until a navigation or submit is separately proposed'}
        </span>
      </div>
      <div className={styles.approvalActions}>
        <button type="button" className={styles.approveButton} onPointerDown={onApprove}>
          Approve
        </button>
        <button type="button" className={styles.declineButton} onPointerDown={onDecline}>
          Decline
        </button>
        <span className={styles.keyHint}>Enter approves, Esc declines</span>
      </div>
    </div>
  );
}
