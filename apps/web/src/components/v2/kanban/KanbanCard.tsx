// KanbanCard — sortable card rendering an ObjectRef via a simple card recipe.
// Uses @dnd-kit/sortable for drag handles. Emits nothing directly; the parent
// KanbanBoard handles drag-end → ObjectAction dispatch.

'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ObjectRef } from '@/lib/block-view/types';
import { renderCardField } from './kanban-recipe';
import styles from './kanban.module.css';

export interface KanbanCardProps {
  object: ObjectRef;
  /** Field IDs to show on the card, in order. Defaults to first 4 non-id fields. */
  visibleFields?: string[];
  /** Optional click handler (e.g. open detail). */
  onClick?: (id: string) => void;
}

export function KanbanCard({ object, visibleFields, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: object.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fields = visibleFields ?? defaultVisibleFields(object);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card}${isDragging ? ` ${styles['card-dragging']}` : ''}`}
      role="button"
      tabIndex={0}
      aria-label={cardLabel(object)}
      onClick={() => onClick?.(object.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(object.id);
        }
      }}
    >
      <button
        type="button"
        className={styles['card-handle']}
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <div className={styles['card-body']}>
        {fields.map((f) => (
          <div key={f} className={styles['card-field']} data-field={f}>
            {renderCardField(f, object.properties[f])}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ──

function defaultVisibleFields(obj: ObjectRef): string[] {
  const keys = Object.keys(obj.properties);
  return keys.filter((k) => k !== 'id').slice(0, 4);
}

function cardLabel(obj: ObjectRef): string {
  const title = obj.properties['title'] ?? obj.properties['name'] ?? obj.properties['id'];
  return String(title);
}
