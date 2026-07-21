'use client';

// SOURCING: cmdk Dialog for focus-managed review. Parameter candidates come
// from plan-params extraction; bindings are reviewed before materialize.

import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import type { ParamCandidate } from '@commonplace/theorem-acp/plan-params';

export function PromotionDialog({
  open,
  candidates,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  candidates: readonly ParamCandidate[];
  busy: boolean;
  onClose: () => void;
  onSave: (bindings: Record<string, string>) => void;
}) {
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  // Reset when opened (or when the candidate set changes) so reopen does not
  // reuse edits from a prior plan review.
  useEffect(() => {
    if (!open) return;
    setBindings(Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate.value])));
    setAccepted(Object.fromEntries(candidates.map((candidate) => [candidate.id, true])));
  }, [open, candidates]);

  if (!open) return null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      label="Save as program"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-ij-frame opacity-75"
      contentClassName="promotion-dialog-content fixed inset-x-0 z-50 mx-auto max-w-full outline-none"
    >
      <div className="overflow-hidden rounded-ij-arc border border-ij-seam bg-ij-raised text-ij-ink" data-promotion-dialog>
        <header className="border-b border-ij-divider px-4 py-3">
          <div className="text-ij-ink-info">Save as program</div>
          <h3 className="mt-1" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Review parameter candidates</h3>
        </header>
        <Command.List className="max-h-96 overflow-auto p-3">
          {candidates.length === 0 ? (
            <div className="p-2 text-ij-ink-info">No string literals or target references were flagged.</div>
          ) : (
            candidates.map((candidate) => (
              <div key={candidate.id} className="mb-2 grid gap-1 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-2">
                <div className="flex items-center gap-2">
                  <strong className="truncate">{candidate.label}</strong>
                  <span className="ml-auto font-ij-mono text-ij-ink-info">{candidate.kind}</span>
                  <label className="flex items-center gap-1 text-ij-ink-info">
                    <input
                      type="checkbox"
                      checked={accepted[candidate.id] !== false}
                      onChange={(event) => setAccepted((current) => ({ ...current, [candidate.id]: event.target.checked }))}
                    />
                    accept
                  </label>
                </div>
                <input
                  value={bindings[candidate.id] ?? candidate.value}
                  onChange={(event) => setBindings((current) => ({ ...current, [candidate.id]: event.target.value }))}
                  aria-label={candidate.label}
                  className="h-ij-control w-full rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 font-ij-mono focus:outline-2 focus:outline-ij-accent"
                />
              </div>
            ))
          )}
        </Command.List>
        <div className="flex gap-2 border-t border-ij-divider p-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const next: Record<string, string> = {};
              for (const candidate of candidates) {
                if (accepted[candidate.id] === false) continue;
                next[candidate.id] = bindings[candidate.id] ?? candidate.value;
              }
              onSave(next);
            }}
            className="ml-auto h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:opacity-50"
          >
            Save program
          </button>
        </div>
      </div>
    </Command.Dialog>
  );
}
