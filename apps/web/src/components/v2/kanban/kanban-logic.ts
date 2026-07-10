// Pure logic for the kanban board: no React or dnd-kit dependencies.
// Extracted so tests can import these without triggering the React/dnd-kit
// module tree (which requires jsdom).

import type { ObjectRef, ObjectSet } from '@/lib/block-view/types';

export interface KanbanColumnDef {
  value: string;
  label: string;
  objects: ObjectRef[];
}

/** Derive kanban columns from objects grouped by `field`. */
export function deriveColumns(
  objects: readonly ObjectRef[],
  field: string,
): KanbanColumnDef[] {
  const groups = new Map<string, ObjectRef[]>();

  for (const obj of objects) {
    const raw = obj.properties[field];
    const key = raw !== null && raw !== undefined ? String(raw) : '(none)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(obj);
  }

  return Array.from(groups.entries()).map(([value, objs]) => ({
    value,
    label: value === '(none)' ? 'Uncategorized' : formatColumnLabel(value),
    objects: objs,
  }));
}

/** Find which column value a card currently belongs to. */
export function findColumnForCard(
  objects: readonly ObjectRef[],
  field: string,
  cardId: string,
): string | null {
  const obj = objects.find((o) => o.id === cardId);
  if (!obj) return null;
  const raw = obj.properties[field];
  return raw !== null && raw !== undefined ? String(raw) : '(none)';
}

/**
 * Resolve a drag-drop target to a COLUMN value.
 *
 * dnd-kit reports `overId` as whatever registered droppable or sortable sits
 * under the cursor at drop time. Dropping onto an EMPTY column yields that
 * column's droppable id (the group value). Dropping onto a POPULATED column
 * yields the sortable id of a card under the cursor (an object id), NOT the
 * column. Writing that object id straight into the group field is the TW3
 * drop-target bug, so when `overId` matches a card we map it back to the column
 * that card currently lives in. When it matches no card, `overId` is already a
 * column value and passes through unchanged.
 */
export function resolveDropColumn(
  objects: readonly ObjectRef[],
  field: string,
  overId: string,
): string {
  return findColumnForCard(objects, field, overId) ?? overId;
}

/** Pick a sensible default group-by field from the ObjectShape. */
export function detectGroupField(set: ObjectSet): string {
  const fields = set.shape.fields;
  const statusField = fields.find(
    (f) => f === 'status' || f === 'state' || f === 'stage',
  );
  if (statusField) return statusField;
  return fields.find((f) => f !== 'id') ?? 'id';
}

// ── Internal ──

function formatColumnLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
