import type { IndexRow, IndexRowDestination } from '@/lib/commonplace/index-queries';

/* Pure board-grouping for the Kanban lens, kept dependency-free of React and
   @dnd-kit so it unit-tests directly. A board column is a destination; dragging
   a card to another column is a refile. This module decides the columns and
   whether a given drop is a real refile or a no-op. */

export const UNFILED_KEY = '__unfiled__';
export const UNFILED_LABEL = 'Unfiled';

export interface KanbanColumn {
  /** Stable column id: the destination label, or UNFILED_KEY. Doubles as the
   *  refile target for filed columns (a destination is addressed by its label). */
  readonly key: string;
  readonly label: string;
  readonly rows: readonly IndexRow[];
}

/** Group rows into board columns by their (possibly overridden) destination.
 *  Column order is first-appearance in row order, with the Unfiled bucket last
 *  so the actionable, filed columns lead. A row with no destination lands in
 *  Unfiled. */
export function groupRowsByDestination(
  rows: readonly IndexRow[],
  destinationFor: (row: IndexRow) => IndexRowDestination | null,
): readonly KanbanColumn[] {
  const order: string[] = [];
  const byKey = new Map<string, { label: string; rows: IndexRow[] }>();
  for (const row of rows) {
    const dest = destinationFor(row);
    const key = dest ? dest.label : UNFILED_KEY;
    const label = dest ? dest.label : UNFILED_LABEL;
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { label, rows: [] };
      byKey.set(key, bucket);
      order.push(key);
    }
    bucket.rows.push(row);
  }
  const filed = order.filter((k) => k !== UNFILED_KEY);
  const keys = byKey.has(UNFILED_KEY) ? [...filed, UNFILED_KEY] : filed;
  return keys.map((key) => {
    const bucket = byKey.get(key)!;
    return { key, label: bucket.label, rows: bucket.rows };
  });
}

/** The destination label a drop onto `toColumnKey` should refile to, or null if
 *  the drop changes nothing: same column, or the Unfiled column (which is the
 *  absence of a destination, not a destination you can file into). */
export function refileTargetForColumn(
  toColumnKey: string,
  fromColumnKey: string,
): string | null {
  if (toColumnKey === fromColumnKey) return null;
  if (toColumnKey === UNFILED_KEY) return null;
  return toColumnKey;
}
