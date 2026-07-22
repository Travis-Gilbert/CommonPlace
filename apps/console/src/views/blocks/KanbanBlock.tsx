'use client';

// SOURCING: hand-roll + dnd-kit. First acceptsChildren container
// (HANDOFF-CONSOLE-ONE-BLOCK-MODEL OB7). Columns accept other blocks;
// innermost-accepting-container collision lives in block-collision.ts.

import { useDroppable } from '@dnd-kit/core';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ViewRenderProps } from '@commonplace/block-view/types';

const COLUMNS = [
  { id: 'todo', label: 'Todo' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
] as const;

function KanbanColumn({
  columnId,
  label,
  hostDescriptorId,
  children,
}: {
  readonly columnId: string;
  readonly label: string;
  readonly hostDescriptorId: string;
  readonly children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `container:kanban:${hostDescriptorId}:${columnId}`,
    data: {
      type: 'container',
      acceptsChildren: true,
      accepts: ['*'] as const,
      layout: 'columns',
      columnId,
      descriptorId: hostDescriptorId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      data-block-container
      data-kanban-column={columnId}
      className={`flex min-h-40 min-w-0 flex-1 flex-col gap-2 rounded-ij-arc border border-dashed p-2 ${
        isOver ? 'border-ij-accent bg-ij-selection' : 'border-ij-seam-raised'
      }`}
    >
      <h3 className="font-ij-mono text-ij-island-meta text-ij-ink-info">{label}</h3>
      <div className="flex min-h-0 flex-1 flex-col gap-1">{children}</div>
    </div>
  );
}

export function KanbanBlock({ instance }: ViewRenderProps) {
  const hostDescriptorId = String(instance.properties.descriptor_id ?? 'kanban');
  const [membership, setMembership] = useState<Record<string, string>>({});

  useEffect(() => {
    const onNest = (event: Event) => {
      const detail = (event as CustomEvent<{ childId?: string; columnId?: string }>).detail;
      if (!detail?.childId || !detail.columnId) return;
      setMembership((current) => ({ ...current, [detail.childId!]: detail.columnId! }));
    };
    window.addEventListener('commonplace:block-nest', onNest);
    return () => window.removeEventListener('commonplace:block-nest', onNest);
  }, []);

  const byColumn = useMemo(() => {
    const buckets: Record<string, string[]> = { todo: [], doing: [], done: [] };
    for (const [childId, columnId] of Object.entries(membership)) {
      (buckets[columnId] ?? buckets.todo!).push(childId);
    }
    return buckets;
  }, [membership]);

  return (
    <div
      data-kanban-board
      data-block-container
      className="flex h-full min-h-0 gap-2 overflow-auto p-2"
      onDrop={(event) => {
        event.preventDefault();
        const childId = event.dataTransfer.getData('text/view-instance-id');
        const columnId = (event.target as HTMLElement)
          .closest<HTMLElement>('[data-kanban-column]')
          ?.dataset.kanbanColumn;
        if (!childId || !columnId) return;
        setMembership((current) => ({ ...current, [childId]: columnId }));
      }}
      onDragOver={(event) => event.preventDefault()}
    >
      {COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          columnId={column.id}
          label={column.label}
          hostDescriptorId={hostDescriptorId}
        >
          {(byColumn[column.id] ?? []).map((childId) => (
            <div
              key={childId}
              data-kanban-card={childId}
              className="rounded-ij-arc border border-ij-seam bg-ij-raised px-2 py-1 text-ij-ink"
            >
              {childId}
            </div>
          ))}
          {(byColumn[column.id] ?? []).length === 0 ? (
            <p className="text-sm text-ij-ink-info">Drop a block here.</p>
          ) : null}
        </KanbanColumn>
      ))}
    </div>
  );
}
