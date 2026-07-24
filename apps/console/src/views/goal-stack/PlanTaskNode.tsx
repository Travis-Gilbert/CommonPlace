'use client';

// SOURCING: @xyflow/react node contract and @dnd-kit/core drop target.
// Presence mark is the sole agent activity glyph (constitution).

import { useDroppable } from '@dnd-kit/core';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { PresenceMark } from '@/components/mark/PresenceMark';
import type { GoalFlowNode } from './plan-layout';

export function PlanTaskNode({ data, selected }: NodeProps<GoalFlowNode>) {
  const task = data.task;
  const { isOver, setNodeRef } = useDroppable({
    id: `goal-task:${task.id}`,
    data: { taskId: task.id },
    disabled: task.status !== 'pending' || Boolean(task.claimHolder),
  });
  const failed = task.status === 'failed';
  const blocked = task.status === 'blocked';
  const escalated = task.status === 'escalated';
  const verified = task.status === 'verified';
  const running = task.status === 'running' || task.status === 'claimed' || task.status === 'verifying';
  const ring = failed
    ? 'var(--ij-error)'
    : blocked || escalated
      ? 'var(--ij-warn)'
    : verified
      ? 'var(--ij-ok)'
      : running
        ? 'var(--ij-accent)'
        : 'var(--ij-seam-raised)';
  const actorLabel = task.actor ?? task.claimHolder;
  return (
    <article
      ref={setNodeRef}
      data-plan-task={task.id}
      data-plan-status={task.status}
      data-plan-path={data.pathRole}
      data-plan-branch={task.branch ? 'true' : 'false'}
      className="h-full overflow-hidden rounded-ij-arc border bg-ij-chrome text-ij-ink"
      style={{
        borderColor: isOver || selected || data.pathRole === 'selected'
          ? 'var(--ij-accent)'
          : data.onPath && data.pathRole !== 'idle'
            ? 'var(--ij-accent)'
            : ring,
        boxShadow: `inset 0 0 0 2px ${ring}`,
        opacity: task.status === 'superseded' ? 0.46 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex h-ij-control items-center gap-2 border-b border-ij-divider px-3">
        <span className="font-ij-mono text-ij-ink-info">{task.kind}</span>
        {task.branch ? <span className="rounded-ij-arc-underline bg-ij-selection-inactive px-1">branch</span> : null}
        <span className="ml-auto" data-task-state>{task.status}</span>
        {running && actorLabel ? (
          <span className="flex items-center gap-1" title={actorLabel} data-task-presence={actorLabel}>
            <PresenceMark state="acting" size={18} staticOnly />
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <strong className="block truncate" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{task.title}</strong>
        <p className="mt-1 line-clamp-2 text-ij-ink-info">{task.description}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {actorLabel ? (
            <span className="rounded-ij-arc-underline bg-ij-selection-inactive px-1 font-ij-mono" data-actor-badge>
              {actorLabel}
            </span>
          ) : null}
          {task.admissionRequirement === 'require_approval' ? (
            <span
              className="rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn"
              data-approval-badge={task.approvalReceipt ? 'approved' : 'required'}
            >
              {task.approvalReceipt ? 'approved' : 'approval'}
            </span>
          ) : null}
          {task.escalation ? (
            <span
              className="rounded-ij-arc-underline bg-ij-warn-bg px-1 font-ij-mono text-ij-warn"
              data-task-escalation={task.escalation.targetHead}
              title={`${task.escalation.trigger}: ${task.escalation.fromHead ?? 'unknown'} to ${task.escalation.targetHead}`}
            >
              escalated to {task.escalation.targetHead}
            </span>
          ) : null}
          {task.changedEvents.length > 0 ? (
            <span
              className="rounded-ij-arc-underline bg-ij-selection-inactive px-1 font-ij-mono"
              data-task-changed
            >
              Changed
            </span>
          ) : null}
          {task.attachments.slice(0, 4).map((attachment) => (
            <span
              key={attachment.entry}
              className="rounded-ij-arc-underline px-1 font-ij-mono"
              data-attachment-chip={attachment.entry}
              data-grant={attachment.grantState}
              style={{
                background: attachment.grantState === 'locked' ? 'var(--ij-warn-bg)' : 'var(--ij-selection-inactive)',
                color: attachment.grantState === 'locked' ? 'var(--ij-warn)' : undefined,
              }}
              title={attachment.grantState === 'locked'
                ? `Locked: ${attachment.missingCapability ?? 'missing grant'}`
                : attachment.entry}
            >
              {attachment.entry.split(':').at(-1) ?? attachment.entry}
              {attachment.grantState === 'locked' ? ' locked' : ''}
            </span>
          ))}
          {task.attachments.length > 4 ? (
            <span className="rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn">
              +{task.attachments.length - 4}
            </span>
          ) : null}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}
