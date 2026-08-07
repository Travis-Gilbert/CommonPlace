'use client';

// SOURCING: keenthemes/reui kanban-board-5 block (c-kanban-5) on the local
// ui/kanban primitive, register-skinned. The typed containment contract is
// unchanged (AMENDMENT-02 A2-1/A2-2): columns still register canvas-context
// droppables (ColumnContainmentDroppable bridges the board's own DndContext to
// the ground canvas), and card drops persist column stamps and order through
// host.emit. Children parent under this view-instance through CONTAINS; the
// selected column remains on child config.kanbanColumn.

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import {
  moveSurfaceNodeAction,
  updateViewInstanceConfigAction,
} from '@commonplace/block-view/surface-actions';
import type {
  BlockHost,
  ObjectAction,
  ObjectRef,
  ObjectSet,
  ViewRenderProps,
} from '@commonplace/block-view/types';
import { ViewInstanceHost } from '@/components/shell/ViewInstanceHost';
import {
  readConfigRecord,
  readKanbanColumn,
  type KanbanColumnId,
} from '@/lib/block-placement';
import { Pill } from 'twenty-ui/data-display';
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  type KanbanCommitMeta,
} from '@/components/ui/kanban';
import { cn } from '@/lib/utils';

const COLUMNS: readonly { id: KanbanColumnId; label: string; dotClass: string }[] = [
  { id: 'todo', label: 'Todo', dotClass: 'bg-ij-link' },
  { id: 'doing', label: 'Doing', dotClass: 'bg-ij-warn' },
  { id: 'done', label: 'Done', dotClass: 'bg-ij-ok' },
];

const LAYOUT_QUERY = {
  types: ['surface', 'region', 'view-instance'] as const,
};

/**
 * Re-registers each column as a droppable in the AMBIENT drag context (the
 * ground BlockCanvas DndContext) so palette and ground blocks can still be
 * contained into a column. The board's own DndContext (ui/kanban) is nested
 * and owns card sorting only; useDroppable must be called under the outer
 * context, so this bridge renders as a sibling of the Kanban root and points
 * dnd-kit's node ref at the rendered column element for measuring.
 */
function ColumnContainmentDroppable({
  columnId,
  containerId,
  hostDescriptorId,
  boardRef,
}: {
  readonly columnId: KanbanColumnId;
  readonly containerId: string;
  readonly hostDescriptorId: string;
  readonly boardRef: RefObject<HTMLDivElement | null>;
}) {
  const { setNodeRef } = useDroppable({
    id: `container:kanban:${containerId}:${columnId}`,
    data: {
      type: 'container',
      acceptsDrop: {
        semantic: 'contain',
        layout: 'columns',
        accepts: ['*'] as const,
      },
      columnId,
      descriptorId: hostDescriptorId,
      viewInstanceId: containerId,
    },
  });

  useEffect(() => {
    const columnNode =
      (boardRef.current?.querySelector(
        `[data-kanban-column="${columnId}"]`,
      ) as HTMLElement | null) ?? null;
    setNodeRef(columnNode);
  }, [boardRef, setNodeRef, columnId]);

  return null;
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
      unsubscribe = set.subscribe(publish);
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
  const boardRef = useRef<HTMLDivElement | null>(null);

  const value = useMemo(() => {
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

  // The primitive needs a write path for its live drag preview; host truth
  // (nested) re-adopts after commits round-trip through the host. Derived
  // state update during render, the same pattern useContainerChildren uses.
  const [draft, setDraft] = useState<Record<KanbanColumnId, ObjectRef[]>>(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  const commit = (
    next: Record<KanbanColumnId, ObjectRef[]>,
    meta: KanbanCommitMeta<ObjectRef>,
  ) => {
    if (!containerId || meta.kind !== 'item') return;
    const actions: ObjectAction[] = [];
    let order = 0;
    for (const columnId of COLUMNS.map((column) => column.id)) {
      for (const ref of next[columnId]) {
        actions.push(moveSurfaceNodeAction(ref.id, containerId, order));
        if (readKanbanColumn(ref) !== columnId) {
          actions.push(
            updateViewInstanceConfigAction(ref.id, {
              ...readConfigRecord(ref),
              kanbanColumn: columnId,
            }),
          );
        }
        order += 1;
      }
    }
    for (const action of actions) void host.emit(action);
  };

  if (!containerId) {
    return (
      <p className="p-2 text-sm text-ij-ink-info" data-kanban-missing-instance>
        Kanban needs a view-instance to parent children.
      </p>
    );
  }

  return (
    <>
      <Kanban
        value={draft}
        onValueChange={setDraft}
        getItemValue={(item) => item.id}
        onValueCommit={commit}
      >
        <KanbanBoard
          ref={boardRef}
          className="grid h-full min-h-0 grid-cols-3 gap-2 overflow-auto p-2"
          data-kanban-board
          data-block-container
          data-kanban-container={containerId}
        >
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              value={column.id}
              data-kanban-column={column.id}
              className="min-h-0"
            >
              <div className="flex h-full min-h-40 flex-col gap-2 rounded-ij-arc border border-ij-seam bg-ij-hover-surface/50 p-2.5">
                <header className="flex flex-row items-center gap-2">
                  <div
                    className={cn('size-2 rounded-full', column.dotClass)}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium capitalize text-ij-ink">
                    {column.label}
                  </span>
                  <Pill label={String(value[column.id].length)} className="ml-auto" />
                </header>
                <KanbanColumnContent
                  value={column.id}
                  className="flex min-h-0 flex-1 flex-col gap-2 p-0.5"
                >
                  {value[column.id].map((child) => (
                    <KanbanItem
                      key={child.id}
                      value={child.id}
                      data-kanban-card={child.id}
                      className="min-h-0"
                    >
                      <KanbanItemHandle className="rounded-ij-arc border border-ij-seam bg-ij-raised p-2">
                        <ViewInstanceHost instance={child} host={host} bare />
                      </KanbanItemHandle>
                    </KanbanItem>
                  ))}
                  {value[column.id].length === 0 ? (
                    <p className="text-sm text-ij-ink-info">
                      Drop a block here.
                    </p>
                  ) : null}
                </KanbanColumnContent>
              </div>
            </KanbanColumn>
          ))}
        </KanbanBoard>
        <KanbanOverlay className="rounded-md border-2 border-dashed border-ij-seam-raised bg-ij-hover-surface/50" />
      </Kanban>
      {COLUMNS.map((column) => (
        <ColumnContainmentDroppable
          key={column.id}
          columnId={column.id}
          containerId={containerId}
          hostDescriptorId={hostDescriptorId}
          boardRef={boardRef}
        />
      ))}
    </>
  );
}
