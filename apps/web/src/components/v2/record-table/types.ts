// Record table local types.
// Operates on an ObjectSet from the block-view contract and renders any
// ObjectShape through the column-definition registry.

import type { ObjectRef, ObjectShape, PropType } from '@/lib/block-view/types';

// ── Column definition ──

/** How a column appears in the table header. */
export interface ColumnMeta {
  id: string;
  field: string;
  propType: PropType;
  label: string;
  /** Icon name for the column type badge. Uses simple text labels as icons by
   *  default (T for text, # for number, ✓ for boolean, etc.). */
  typeIcon: string;
  /** Whether this column can be hidden (true for most, false for id/name). */
  hideable: boolean;
  /** Whether inline editing is allowed on this field. */
  editable: boolean;
  /** Default width in px. */
  defaultWidth: number;
  /** Min width in px. */
  minWidth: number;
}

/** Derive column metadata from an ObjectShape, optionally using the first
 *  object's property values to infer field types. Falls back to heuristics
 *  when no sample object is available. */
export function columnsFromShape(
  shape: ObjectShape,
  sample?: ObjectRef,
): ColumnMeta[] {
  const typeIconFor = (pt: PropType): string => {
    switch (pt) {
      case 'string': return 'T';
      case 'text': return '¶';
      case 'number':
      case 'integer': return '#';
      case 'boolean': return '✓';
      case 'json': return '{}';
      case 'id': return '№';
      case 'timestamp_ms': return '⏱';
      case 'vector': return '⬡';
      case 'string_list': return '[]';
      default: return '?';
    }
  };

  const inferPropType = (value: unknown): PropType => {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    if (Array.isArray(value)) return 'string_list';
    if (typeof value === 'object') return 'json';
    if (typeof value === 'string') {
      // Heuristic: if it looks like a timestamp, mark it
      if (/^\d{13,}$/.test(value)) return 'timestamp_ms';
      return 'string';
    }
    return 'string';
  };

  return shape.fields.map((field, idx) => {
    // Infer type from sample object properties, or fall back to heuristics
    const sampleValue = sample?.properties[field];
    const pt: PropType = sampleValue !== undefined
      ? inferPropType(sampleValue)
      : idx === 0 ? 'id' : 'string';

    return {
      id: field,
      field,
      propType: pt,
      label: field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      typeIcon: typeIconFor(pt),
      hideable: field !== 'id' && field !== 'title',
      editable: field !== 'id',
      defaultWidth: field === 'id' ? 200 : 160,
      minWidth: field === 'id' ? 120 : 80,
    };
  });
}

// ── Sort state ──

export type SortDirection = 'asc' | 'desc';

export interface SortChip {
  field: string;
  direction: SortDirection;
}

// ── Filter state ──

export type FilterOp = 'contains' | 'eq' | 'gt' | 'lt' | 'gte' | 'lte';

export interface FilterChip {
  id: string;
  field: string;
  op: FilterOp;
  value: string;
}

// ── Group-by state ──

export interface GroupBySpec {
  field: string;
  /** Whether groups start expanded. */
  expanded: boolean;
}

// ── Editing state ──

export interface CellEditState {
  rowId: string;
  field: string;
  value: string;
}

// ── Row selection ──

export type SelectionMode = 'none' | 'single' | 'multi';

// ── Table view state ──

export interface RecordTableState {
  // Column config
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnWidths: Record<string, number>;

  // Sorting
  sorts: SortChip[];

  // Filtering
  filters: FilterChip[];

  // Grouping
  groupBy: GroupBySpec | null;
  collapsedGroups: Set<string>;

  // Selection
  selectionMode: SelectionMode;
  selectedIds: Set<string>;

  // Editing
  editingCell: CellEditState | null;

  // Pagination
  cursor: string | null;
  hasMore: boolean;

  // Loading
  isLoading: boolean;
}

export const DEFAULT_TABLE_STATE: RecordTableState = {
  columnOrder: [],
  columnVisibility: {},
  columnWidths: {},
  sorts: [],
  filters: [],
  groupBy: null,
  collapsedGroups: new Set(),
  selectionMode: 'multi',
  selectedIds: new Set(),
  editingCell: null,
  cursor: null,
  hasMore: true,
  isLoading: false,
};
