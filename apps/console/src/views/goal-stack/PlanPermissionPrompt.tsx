'use client';

// SOURCING: cmdk Dialog and Command items provide the installed modal,
// focus-management, and keyboard-selection primitive. The decision is sent to
// the canonical Plan approval path; this component never fabricates receipts.

import { Command } from 'cmdk';
import type { PlanTask } from '@commonplace/theorem-acp/plan-state';

export function PlanPermissionPrompt({
  task,
  busy,
  decide,
}: {
  task: PlanTask | null;
  busy: boolean;
  decide: (decision: 'allow' | 'reject') => void;
}) {
  const open = task?.admissionRequirement === 'require_approval' && !task.approvalReceipt;
  return (
    <Command.Dialog
      open={open}
      onOpenChange={() => undefined}
      label="Approval required"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-ij-ground opacity-75"
      contentClassName="fixed inset-x-0 top-1/3 z-50 mx-auto w-144 max-w-full outline-none"
    >
      <div className="overflow-hidden rounded-ij-arc border border-ij-warn bg-ij-raised text-ij-ink shadow-xl" data-plan-permission>
        <header className="border-b border-ij-divider bg-ij-warn-bg px-4 py-3">
          <div className="text-ij-warn">Approval required</div>
          <h3 className="mt-1" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{task?.title}</h3>
        </header>
        <div className="px-4 py-3 text-ij-ink-info">
          A destructive annotated affordance is queued on this node. Approval is one-shot and is recorded by the Plan substrate.
        </div>
        <Command.List className="grid grid-cols-2 gap-2 border-t border-ij-divider p-3">
          <Command.Item
            value="Allow once"
            disabled={busy}
            onSelect={() => decide('allow')}
            className="flex h-ij-control cursor-default items-center justify-center rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright data-[disabled=true]:opacity-50 data-[selected=true]:bg-ij-accent-hover"
          >
            Allow once
          </Command.Item>
          <Command.Item
            value="Reject"
            disabled={busy}
            onSelect={() => decide('reject')}
            className="flex h-ij-control cursor-default items-center justify-center rounded-ij-arc border border-ij-control-border px-3 data-[disabled=true]:opacity-50 data-[selected=true]:bg-ij-hover-surface"
          >
            Reject
          </Command.Item>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
