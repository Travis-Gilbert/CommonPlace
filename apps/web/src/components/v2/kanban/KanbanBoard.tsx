// KanbanBoard: TW3 kanban board consuming the same {objectSet, host} contract
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
import type { BlockHost, JsonValue, ObjectRef, ObjectSet } from '@/lib/block-view/types';
import {
  deriveColumns,
  findColumnForCard,
  resolveDropColumn,
  detectGroupField,
} from './kanban-logic';
import type { KanbanColumnDef } from './kanban-logic';
import { selectCardFields } from './kanban-recipe';
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

  // Card fields: type-aware selection from a representative object (title first,
  // then the most meaningful fields for that object's type), excluding the
  // group field the column header already encodes.
  const cardFields = useMemo(() => {
    const first = objects[0];
    if (!first) return [];
    return selectCardFields(first, { groupField });
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
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const cardId = String(active.id);
      const currentColumn = findColumnForCard(objects, groupField, cardId);
      if (!currentColumn) return;

      // Resolve the drop target to its COLUMN: over.id is a sortable card id
      // when the drop lands on a populated column, so mapping it back to that
      // card's column keeps us from writing a card UUID into the group field.
      // Keyboard drops reach here through the same path, so they resolve too.
      const targetColumn = resolveDropColumn(objects, groupField, String(over.id));
      if (currentColumn === targetColumn) return;

      // Write the field change with a receipt behind one line: one emit, awaited.
      // The board renders from objectSet props with no optimistic state, so a
      // rejected write simply leaves the card in its original column.
      const patch: Record<string, JsonValue> = { [groupField]: targetColumn };
      const result = await host.emit({ kind: 'update', id: cardId, patch });
      if (!result.ok) {
        console.error(
          `KanbanBoard: move of ${cardId} to "${targetColumn}" was rejected:`,
          result.error ?? result.value?.note ?? 'unknown error',
        );
      }
    },
    [objects, groupField, host],
  );

  const handleAddCard = useCallback(
    async (columnValue: string) => {
      if (!groupField) return;
      // Same one-emit-awaited contract as a move: honor the receipt so a
      // rejected create is not silently swallowed.
      const result = await host.emit({
        kind: 'create',
        type: objectSet.shape.types[0] ?? 'task',
        props: { [groupField]: columnValue },
      });
      if (!result.ok) {
        console.error(
          `KanbanBoard: create in "${columnValue}" was rejected:`,
          result.error ?? result.value?.note ?? 'unknown error',
        );
      }
    },
    [groupField, host, objectSet],
  );

  if (!objects.length) {
    return (
      <div className={styles['kb-empty']} role="status">
        <div className={styles['kb-empty-icon']} aria-hidden="true">▦</div>
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
                      void handleAddCard(col.value);
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
