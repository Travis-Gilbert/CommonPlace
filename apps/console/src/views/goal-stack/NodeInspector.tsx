'use client';

// SOURCING: @commonplace/block-view descriptor panel contract. Mutations go
// through the identity-bound Plan route and never edit the projection locally.

import type { PlanTask } from '@commonplace/theorem-acp/plan-state';

export function NodeInspector({
  task,
  busy,
  mutate,
}: {
  task: PlanTask | null;
  busy: boolean;
  mutate: (action: string, details: Record<string, unknown>) => void;
}) {
  if (!task) return <div className="p-3 text-ij-ink-info">Select a plan node.</div>;
  return (
    <section className="h-full min-h-0 overflow-auto bg-ij-chrome p-3" aria-label="Plan node inspector">
      <div className="text-ij-ink-info">{task.kind} task</div>
      <h3 className="mt-1" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{task.title}</h3>
      <p className="mt-2 text-ij-ink-info">{task.description}</p>
      <dl className="mt-3 grid gap-2">
        <Fact label="Status" value={task.status} />
        <Fact label="Claim holder" value={task.claimHolder ?? 'Unclaimed'} />
        <Fact label="Serves" value={task.serves.join(', ') || 'No criterion edge'} />
        <Fact label="Generation window" value={`${task.generationAtStart ?? 'none'} to ${task.generationAtEnd ?? 'none'}`} />
      </dl>

      <div className="mt-4">
        <strong>Queued affordances</strong>
        <ul className="mt-2 grid gap-1">
          {task.queuedAffordances.map((affordance) => (
            <li key={affordance.ref} className="flex items-center gap-2 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-2">
              <span className="min-w-0 flex-1 truncate font-ij-mono">{affordance.ref}</span>
              {affordance.annotations.destructive ? <span className="text-ij-warn">destructive</span> : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => mutate('remove_affordance', { taskId: task.id, affordanceRef: affordance.ref })}
                className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      {task.admissionRequirement === 'require_approval' && !task.approvalReceipt ? (
        <div className="mt-4 rounded-ij-arc border border-ij-warn bg-ij-warn-bg p-3 text-ij-warn">
          Approval required before this node can be claimed.
        </div>
      ) : null}

      {task.changedEvents.length ? (
        <div className="mt-4">
          <strong>Changed paths</strong>
          <ul className="mt-2 grid gap-1 font-ij-mono text-ij-ink-info">
            {task.changedEvents.map((event) => <li key={`${event.path}:${event.generation}`}>{event.path}</li>)}
          </ul>
        </div>
      ) : null}

      {task.status === 'failed' || task.status === 'blocked' || task.status === 'superseded' ? (
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => mutate('revert_task', { taskId: task.id })}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
          >
            Revert this task&apos;s file changes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => mutate('replan_subtree', { taskId: task.id })}
            className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright"
          >
            Replan subtree
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-ij-divider pb-2">
      <dt className="text-ij-ink-info">{label}</dt>
      <dd className="break-words font-ij-mono">{value}</dd>
    </div>
  );
}
