// KanbanBoard — TW3 kanban board consuming the same {objectSet, host} contract
// as RecordTable. Groups objects by a configurable field into columns, enables
// drag-to-move between columns via @dnd-kit, and emits ObjectAction updates on
// drop.
//
// Usage:
//   <KanbanBoard objectSet={set} host={blockHost} groupByField="status" />

'use client';

import { useCallback, useMemo, useState, type FC } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { BlockHost, ObjectRef, ObjectSet } from '@/lib/block-view/types';
import { deriveColumns, findColumnForCard, detectGroupField } from './kanban-logic';
import type { KanbanColumnDef } from './kanban-logic';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import styles from './kanban.module.css';

export interface KanbanBoardProps {
  objectSet: ObjectSet;
  host: BlockHost;
  /** Field to group columns by. Defaults to first non-id string field. */
  groupByField?: string;
  /** Called when a card is clicked (e.g. to open detail view). */
  onCardClick?: (id: string) => void;
}

export const KanbanBoard: FC<KanbanBoardProps> = ({
  objectSet,
  host,
  groupByField,
  onCardClick,
}) => {
  const objects = objectSet.objects as ObjectRef[];
  const [activeId, setActiveId] = useState<string | null>(null);

  // Determine which field to group by
  const groupField = useMemo(
    () => groupByField ?? detectGroupField(objectSet),
    [groupByField, objectSet],
  );

  // Derive columns: unique values of groupField across all objects
  const columns = useMemo(() => deriveColumns(objects, groupField), [objects, groupField]);

  // Card fields: all non-id fields (up to 4)
  const cardFields = useMemo(() => {
    const first = objects[0];
    if (!first) return [];
    return Object.keys(first.properties).filter((k) => k !== 'id' && k !== groupField).slice(0, 4);
  }, [objects, groupField]);

  // Sensors: pointer + keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const cardId = String(active.id);
      const targetColumn = String(over.id);

      // Find which column the card is currently in
      const currentColumn = findColumnForCard(objects, groupField, cardId);
      if (!currentColumn || currentColumn === targetColumn) return;

      // Emit update: change the groupBy field to the target column value
      const patch: Record<string, string> = { [groupField]: targetColumn };
      host.emit({ kind: 'update', id: cardId, patch });
    },
    [objects, groupField, host],
  );

  if (!objects.length) {
    return (
      <div className={styles['kb-empty']} role="status">
        <div className={styles['kb-empty-icon']}>📋</div>
        <p className={styles['kb-empty-text']}>No records yet</p>
        <p className={styles['kb-empty-hint']}>
          Create records to see them organized on the board.
        </p>
      </div>
    );
  }

  const activeObject = activeId
    ? objects.find((o) => o.id === activeId) ?? null
    : null;

  return (
    <div className={`${styles['kb-root']} porcelain`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={styles['kb-board']}>
          {columns.map((col) => (
            <KanbanColumn
              key={col.value}
              columnValue={col.value}
              label={col.label}
              objects={col.objects}
              cardFields={cardFields}
              onAdd={
                groupField
                  ? () => {
                      host.emit({
                        kind: 'create',
                        type: objectSet.shape.types[0] ?? 'task',
                        props: { [groupField]: col.value },
                      });
                    }
                  : undefined
              }
              onCardClick={onCardClick}
            />
          ))}
        </div>
        <DragOverlay>
          {activeObject ? (
            <div className={styles['card-overlay']}>
              <KanbanCard object={activeObject} visibleFields={cardFields} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export type { KanbanColumnDef } from './kanban-logic';
