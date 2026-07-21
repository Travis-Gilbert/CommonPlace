'use client';

import type { PlanProposal } from '@commonplace/theorem-acp/plan-state';

export function ProposalPanel({
  proposals,
  busy,
  onConsent,
  onDeny,
}: {
  proposals: readonly PlanProposal[];
  busy: boolean;
  onConsent: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  if (proposals.length === 0) return null;
  return (
    <section className="border-b border-ij-seam bg-ij-warn-bg px-3 py-2 text-ij-warn" aria-label="Destructive proposals" data-proposal-panel>
      <strong>Open proposals</strong>
      <ul className="mt-2 grid gap-2">
        {proposals.map((proposal) => (
          <li key={proposal.id} className="rounded-ij-arc border border-ij-warn bg-ij-raised p-2 text-ij-ink" data-proposal={proposal.id}>
            <div className="font-ij-mono text-ij-ink-info">{proposal.taskId}</div>
            <p className="mt-1">{proposal.reason || 'No reason supplied.'}</p>
            {proposal.actor ? <div className="mt-1 font-ij-mono text-ij-ink-info">from {proposal.actor}</div> : null}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onConsent(proposal.id)}
                className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:opacity-50"
              >
                Consent
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDeny(proposal.id)}
                className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
