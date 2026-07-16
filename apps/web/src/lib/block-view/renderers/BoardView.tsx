// SOURCING: @dnd-kit — canonical DnD (HANDOFF-CANON C3; replaces @hello-pangea/dnd)
"use client";

/* Board — objects grouped into columns by a status/tag relation. Dragging a card
   between columns emits an `update` action through the host (real mutation of the
   object model), so the change persists and every other view reflects it. */

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "../database.module.css";
import { groupObjects } from "../database/model";
import { RelationCell } from "./cells";
import type { ViewProps } from "./types";

function BoardCard({
  object,
  groupKey,
  visibleRelations,
  onOpen,
}: {
  object: ViewProps["objects"][number];
  groupKey: string;
  visibleRelations: readonly string[];
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: object.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.boardCard} ${isDragging ? styles.boardDragging : ""}`}
      onClick={() => onOpen(object.id)}
      {...attributes}
      {...listeners}
    >
      <div className={styles.boardCardTitle}>{object.title}</div>
      {visibleRelations
        .filter((k) => k !== groupKey)
        .slice(0, 3)
        .map((k) => {
          const cell = object.cells[k];
          if (!cell || cell.empty) return null;
          return <RelationCell key={k} cell={cell} />;
        })}
    </div>
  );
}

function BoardColumn({
  groupKey,
  columnKey,
  label,
  color,
  objects,
  visibleRelations,
  onOpen,
}: {
  groupKey: string;
  columnKey: string;
  label: string;
  color?: string;
  objects: ViewProps["objects"];
  visibleRelations: readonly string[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: columnKey });
  const ids = useMemo(() => objects.map((o) => o.id), [objects]);

  return (
    <div className={styles.col} ref={setNodeRef}>
      <div className={styles.colHead}>
        {color && <span className={styles.colDot} style={{ background: `var(--tag-${color})` }} />}
        <span className={styles.colName}>{label}</span>
        <span className={styles.colCount}>{objects.length}</span>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {objects.map((o) => (
          <BoardCard
            key={o.id}
            object={o}
            groupKey={groupKey}
            visibleRelations={visibleRelations}
            onOpen={onOpen}
          />
        ))}
      </SortableContext>
    </div>
  );
}

export function BoardView({ objects, view, host, onOpen }: ViewProps) {
  const groupKey = view.groupBy;
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const groups = useMemo(
    () => (groupKey ? groupObjects(objects, groupKey) : []),
    [objects, groupKey],
  );

  const columnByCard = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      for (const o of g.objects) map.set(o.id, g.key);
    }
    return map;
  }, [groups]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      if (!groupKey) return;
      const { active, over } = event;
      if (!over) return;
      const cardId = String(active.id);
      const from = columnByCard.get(cardId);
      let to = columnByCard.get(String(over.id));
      if (!to) {
        // Dropped on a column droppable id.
        to = String(over.id);
      }
      if (!from || !to || from === to) return;
      void host.emit({
        kind: "update",
        id: cardId,
        patch: { [groupKey]: to === "∅" ? [] : [to] },
      });
    },
    [columnByCard, groupKey, host],
  );

  if (!groupKey) return <div className={styles.emptyState}>This view has no group-by relation.</div>;

  const active = activeId ? objects.find((o) => o.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={styles.board}>
        {groups.map((g) => (
          <BoardColumn
            key={g.key}
            groupKey={groupKey}
            columnKey={g.key}
            label={g.label}
            color={g.color}
            objects={g.objects}
            visibleRelations={view.visibleRelations}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <div className={`${styles.boardCard} ${styles.boardDragging}`}>
            <div className={styles.boardCardTitle}>{active.title}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
