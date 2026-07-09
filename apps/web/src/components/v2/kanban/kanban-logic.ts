// Pure logic for the kanban board — no React or dnd-kit dependencies.
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
