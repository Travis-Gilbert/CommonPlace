'use client';

// SOURCING: hand-roll + dnd-kit. First acceptsChildren container
// (HANDOFF-CONSOLE-ONE-BLOCK-MODEL OB7). Children parent under this
// view-instance via CONTAINS; column lives on child config.kanbanColumn.

import { useDroppable } from '@dnd-kit/core';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import type { BlockHost, ObjectRef, ObjectSet, ViewRenderProps } from '@commonplace/block-view/types';
import { ViewInstanceHost } from '@/components/shell/ViewInstanceHost';
import {
  readKanbanColumn,
  type KanbanColumnId,
} from '@/lib/block-placement';

const COLUMNS: readonly { id: KanbanColumnId; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
];

const LAYOUT_QUERY = {
  types: ['surface', 'region', 'view-instance'] as const,
};

function KanbanColumn({
  columnId,
  label,
  containerId,
  hostDescriptorId,
  children,
}: {
  readonly columnId: KanbanColumnId;
  readonly label: string;
  readonly containerId: string;
  readonly hostDescriptorId: string;
  readonly children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `container:kanban:${containerId}:${columnId}`,
    data: {
      type: 'container',
      acceptsChildren: true,
      accepts: ['*'] as const,
      layout: 'columns',
      columnId,
      descriptorId: hostDescriptorId,
      viewInstanceId: containerId,
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

function useContainerChildren(
  host: BlockHost,
  containerId: string | undefined,
): readonly ObjectRef[] {
  const [children, setChildren] = useState<readonly ObjectRef[]>([]);
  const [prevContainerId, setPrevContainerId] = useState(containerId);
  if (containerId !== prevContainerId) {
    setPrevContainerId(containerId);
    if (!containerId) setChildren([]);
  }

  useEffect(() => {
    if (!containerId) return;
    let active = true;
    let unsubscribe = () => {};

    const publish = (set: ObjectSet) => {
      if (!active) return;
      const byId = new Map(set.objects.map((object) => [object.id, object]));
      const parent = byId.get(containerId);
      const ids = parent?.relations?.[CONTAINS_EDGE] ?? [];
      setChildren(
        ids
          .map((id) => byId.get(id))
          .filter((object): object is ObjectRef => object?.type === 'view-instance'),
      );
    };

    void Promise.resolve(host.query({ ...LAYOUT_QUERY })).then((set) => {
      if (!active) return;
      publish(set);
      if (typeof set.subscribe === 'function') {
        unsubscribe = set.subscribe(publish);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [containerId, host]);

  return children;
}

export function KanbanBlock({ host, instance }: ViewRenderProps) {
  const containerId = instance?.id;
  const hostDescriptorId = String(instance?.properties.descriptor_id ?? 'kanban');
  const nested = useContainerChildren(host, containerId);

  const byColumn = useMemo(() => {
    const buckets: Record<KanbanColumnId, ObjectRef[]> = {
      todo: [],
      doing: [],
      done: [],
    };
    for (const child of nested) {
      buckets[readKanbanColumn(child)].push(child);
    }
    return buckets;
  }, [nested]);

  if (!containerId) {
    return (
      <p className="p-2 text-sm text-ij-ink-info" data-kanban-missing-instance>
        Kanban needs a view-instance to parent children.
      </p>
    );
  }

  return (
    <div
      data-kanban-board
      data-block-container
      data-kanban-container={containerId}
      className="flex h-full min-h-0 gap-2 overflow-auto p-2"
    >
      {COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          columnId={column.id}
          label={column.label}
          containerId={containerId}
          hostDescriptorId={hostDescriptorId}
        >
          {(byColumn[column.id] ?? []).map((child) => (
            <div
              key={child.id}
              data-kanban-card={child.id}
              className="min-h-0 overflow-hidden rounded-ij-arc border border-ij-seam"
            >
              <ViewInstanceHost instance={child} host={host} bare />
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
