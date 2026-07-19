'use client';

// SOURCING: @xyflow/react node contract and @dnd-kit/core drop target.

import { useDroppable } from '@dnd-kit/core';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GoalFlowNode } from './plan-layout';

export function PlanTaskNode({ data, selected }: NodeProps<GoalFlowNode>) {
  const task = data.task;
  const { isOver, setNodeRef } = useDroppable({
    id: `goal-task:${task.id}`,
    data: { taskId: task.id },
    disabled: task.status !== 'pending',
  });
  const failed = task.status === 'failed';
  const blocked = task.status === 'blocked';
  const verified = task.status === 'verified';
  return (
    <article
      ref={setNodeRef}
      data-plan-task={task.id}
      data-plan-status={task.status}
      className="h-full overflow-hidden rounded-ij-arc border bg-ij-chrome text-ij-ink"
      style={{
        borderColor: isOver || selected
          ? 'var(--ij-accent)'
          : failed || blocked
            ? 'var(--ij-error)'
            : verified
              ? 'var(--ij-ok)'
              : 'var(--ij-seam-raised)',
        opacity: task.status === 'superseded' ? 0.46 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex h-ij-control items-center gap-2 border-b border-ij-divider px-3">
        <span className="font-ij-mono text-ij-ink-info">{task.kind}</span>
        <span className="ml-auto" data-task-state>{task.status}</span>
      </div>
      <div className="p-3">
        <strong className="block truncate" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{task.title}</strong>
        <p className="mt-1 line-clamp-2 text-ij-ink-info">{task.description}</p>
        <div className="mt-2 flex gap-1">
          {task.serves.slice(0, 3).map((criterion) => (
            <span key={criterion} className="rounded-ij-arc-underline bg-ij-selection-inactive px-1 font-ij-mono text-ij-ink-info">
              {criterion}
            </span>
          ))}
          {task.queuedAffordances.length ? (
            <span className="ml-auto rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn">
              {task.queuedAffordances.length} tools
            </span>
          ) : null}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}
