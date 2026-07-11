// KanbanColumn: a single kanban lane. Header shows the group value, count,
// and a quiet-add button. Body is a droppable area with SortableContext for
// its cards.

'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { ObjectRef } from '@/lib/block-view/types';
import { KanbanCard } from './KanbanCard';
import styles from './kanban.module.css';

export interface KanbanColumnProps {
  /** The group value this column represents (the field value). */
  columnValue: string;
  /** Label to display in the header (formatted). */
  label: string;
  /** Objects in this column. */
  objects: ObjectRef[];
  /** Fields to show on each card. */
  cardFields?: string[];
  /** Called when the "+" button is clicked to add a new card. */
  onAdd?: () => void;
  /** Called when a card is clicked. */
  onCardClick?: (id: string) => void;
}

export function KanbanColumn({
  columnValue,
  label,
  objects,
  cardFields,
  onAdd,
  onCardClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnValue });

  return (
    <div
      className={`${styles.column}${isOver ? ` ${styles['column-over']}` : ''}`}
    >
      <div className={styles['column-header']}>
        <span className={styles['column-label']}>{label}</span>
        <span className={styles['column-count']}>{objects.length}</span>
        {onAdd && (
          <button
            type="button"
            className={styles['column-add']}
            aria-label={`Add card to ${label}`}
            onClick={onAdd}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <div ref={setNodeRef} className={styles['column-body']}>
        <SortableContext
          items={objects.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {objects.length === 0 ? (
            <div className={styles['column-empty']}>No cards</div>
          ) : (
            objects.map((obj) => (
              <KanbanCard
                key={obj.id}
                object={obj}
                visibleFields={cardFields}
                onClick={onCardClick}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
