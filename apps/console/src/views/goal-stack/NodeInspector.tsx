'use client';

// SOURCING: @commonplace/block-view descriptor panel contract. Mutations go
// through the identity-bound Plan route and never edit the projection locally.

import { useState } from 'react';
import type { PlanTask } from '@commonplace/theorem-acp/plan-state';

export function NodeInspector({
  task,
  busy,
  mutate,
  onAddChild,
}: {
  task: PlanTask | null;
  busy: boolean;
  mutate: (action: string, details: Record<string, unknown>) => void | Promise<boolean>;
  onAddChild: (parentId: string, title: string, branch: boolean) => void;
}) {
  const [childTitle, setChildTitle] = useState('');
  const [skipReason, setSkipReason] = useState('');
  if (!task) return <div className="p-3 text-ij-ink-info">Select a plan node.</div>;
  const agentOwned = Boolean(task.actor && (
    task.actor.startsWith('agent:')
    || ['codex', 'claude-code', 'qwen', 'mistral', 'deepseek', 'minimax', 'gemma-26b', 'glm-5.1']
      .includes(task.actor)
  ));
  const attachmentsEditable = task.status === 'pending' && !task.claimHolder;
  const taskRevertEligible = task.status === 'failed' || task.status === 'superseded';
  const hasGenerationWindow = task.generationAtStart !== null && task.generationAtEnd !== null;
  return (
    <section className="h-full min-h-0 overflow-auto bg-ij-chrome p-3" aria-label="Plan node inspector">
      <div className="text-ij-ink-info">{task.kind} task</div>
      <h3 className="mt-1" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{task.title}</h3>
      <p className="mt-2 text-ij-ink-info">{task.description}</p>
      <dl className="mt-3 grid gap-2">
        <Fact label="Status" value={task.status} />
        <Fact label="Actor" value={task.actor ?? 'Unattributed'} />
        <Fact label="Claim holder" value={task.claimHolder ?? 'Unclaimed'} />
        <Fact label="Assigned head" value={task.assignedHead ?? 'Unassigned'} />
        <Fact label="Progress" value={task.progressFraction === null ? 'No report' : `${Math.round(task.progressFraction * 100)}%`} />
        <Fact label="Serves" value={task.serves.join(', ') || 'No criterion edge'} />
        <Fact label="Generation window" value={`${task.generationAtStart ?? 'none'} to ${task.generationAtEnd ?? 'none'}`} />
      </dl>

      {task.escalation ? (
        <div className="mt-4 rounded-ij-arc border border-ij-warn bg-ij-warn-bg p-3 text-ij-warn" data-task-escalation-detail>
          <strong>Escalated to {task.escalation.targetHead}</strong>
          <p className="mt-1">Trigger: {task.escalation.trigger}</p>
          <p>From: {task.escalation.fromHead ?? 'Unknown head'}</p>
          <p>Origin receipts: {task.escalation.originatingReceipts.length || 'none'}</p>
        </div>
      ) : null}

      <div className="mt-4">
        <strong>Attachments</strong>
        <ul className="mt-2 grid gap-1">
          {task.attachments.length === 0 ? (
            <li className="text-ij-ink-info">No attachments on this node.</li>
          ) : null}
          {task.attachments.map((attachment) => (
            <li key={attachment.entry} className="flex items-center gap-2 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-2">
              <span className="min-w-0 flex-1 truncate font-ij-mono">{attachment.entry}</span>
              {attachment.grantState === 'locked' ? (
                <span className="text-ij-warn">locked: {attachment.missingCapability ?? 'grant'}</span>
              ) : null}
              {attachment.annotations.destructive ? <span className="text-ij-warn">destructive</span> : null}
              <button
                type="button"
                disabled={busy || !attachmentsEditable}
                onClick={() => mutate('remove_affordance', { taskId: task.id, affordanceRef: attachment.entry })}
                title={attachmentsEditable ? 'Remove attachment' : 'Attachments can change only while the task is pending and unclaimed.'}
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

      <div className="mt-4 grid gap-2">
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!childTitle.trim()) return;
            onAddChild(task.id, childTitle.trim(), false);
            setChildTitle('');
          }}
        >
          <label className="text-ij-ink-info" htmlFor="add-child-title">Add dependent task</label>
          <input
            id="add-child-title"
            value={childTitle}
            onChange={(event) => setChildTitle(event.target.value)}
            className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 focus:outline-2 focus:outline-ij-accent"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !childTitle.trim()} className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:opacity-50">
              Add on path
            </button>
            <button
              type="button"
              disabled={busy || !childTitle.trim()}
              onClick={() => {
                onAddChild(task.id, childTitle.trim(), true);
                setChildTitle('');
              }}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
            >
              Add branch
            </button>
          </div>
        </form>

        <button
          type="button"
          disabled={busy || task.status === 'verified'}
          onClick={() => mutate('complete_task', { taskId: task.id, receipt: `console:${task.id}` })}
          className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
        >
          Mark done
        </button>

        <div className="grid gap-2">
          <input
            value={skipReason}
            onChange={(event) => setSkipReason(event.target.value)}
            placeholder="Skip reason"
            aria-label="Skip reason"
            className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 focus:outline-2 focus:outline-ij-accent"
          />
          <button
            type="button"
            disabled={busy || !skipReason.trim()}
            onClick={() => {
              mutate('skip_task', { taskId: task.id, reason: skipReason.trim() });
              setSkipReason('');
            }}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
          >
            Skip with reason
          </button>
        </div>

        {agentOwned ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => mutate('revert_mutation', { taskId: task.id })}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
          >
            Revert agent-added node
          </button>
        ) : null}

        {taskRevertEligible ? (
          <>
            <button
              type="button"
              disabled={busy || !hasGenerationWindow}
              onClick={() => mutate('revert_task', { taskId: task.id })}
              title={hasGenerationWindow
                ? 'Restore this task generation window'
                : 'No authoritative task generation window is available.'}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
            >
              Revert this task&apos;s file changes
            </button>
            {!hasGenerationWindow ? (
              <p className="text-ij-ink-info">Revert unavailable: this task has no authoritative generation window.</p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => mutate('replan_subtree', { taskId: task.id })}
              className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright"
            >
              Replan subtree
            </button>
          </>
        ) : null}
        {task.status === 'blocked' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => mutate('replan_subtree', { taskId: task.id })}
            className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright"
          >
            Replan subtree
          </button>
        ) : null}
      </div>
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
