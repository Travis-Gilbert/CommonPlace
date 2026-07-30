'use client';

// SOURCING: none. CompilerProposal ghost overlay (PG10).

import type { CompilerProposal, ProgramDiff } from '@commonplace/program-contracts';

export type ProposalOverlayProps = {
  readonly proposal: CompilerProposal | null;
  readonly diff?: ProgramDiff | null;
  readonly onAccept: () => void;
  readonly onReject: () => void;
};

export function ProposalOverlay({ proposal, diff, onAccept, onReject }: ProposalOverlayProps) {
  if (!proposal) return null;
  return (
    <section
      className="absolute bottom-4 left-1/2 z-30 w-full max-w-xl -translate-x-1/2 rounded-ij-arc border border-ij-seam bg-ij-raised px-4 py-3 text-ij-ink shadow-none"
      aria-label="Compiler proposal"
    >
      <p className="text-xs text-ij-ink-info">Advisory compiler proposal. Ghost preview only until accepted.</p>
      <h2 className="mt-1 text-sm" style={{ fontWeight: 'var(--rec-weight-cap)' as never }}>
        {proposal.source_intent}
      </h2>
      <p className="mt-1 font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
        {proposal.compiler_id} · {proposal.compiler_receipt_id}
      </p>
      {diff ? (
        <ul className="mt-2 max-h-28 overflow-auto font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
          {diff.node_ids_only_in_right.map((id) => <li key={`add-${id}`}>+ node {id}</li>)}
          {diff.node_ids_only_in_left.map((id) => <li key={`rm-${id}`}>- node {id}</li>)}
          {diff.changed_node_ids.map((id) => <li key={`ch-${id}`}>~ node {id}</li>)}
        </ul>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onAccept} className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright">
          Accept
        </button>
        <button type="button" onClick={onReject} className="h-ij-control rounded-ij-arc border border-ij-control-border px-3">
          Reject
        </button>
      </div>
    </section>
  );
}
