// TW6 record-table state on Jotai.
//
// The spec requires atom-per-cell / atom-per-row granularity here: on a large
// editable table a single monolithic store re-renders every row on any change.
// So state lives in per-slice atoms, and the hot paths (row selection, cell
// editing) get derived atom families whose value is a primitive boolean, so a
// component only re-renders when ITS row/cell membership actually flips.
//
// The atoms are module-level singletons written through the default Jotai store
// (there is no Jotai Provider; this matches the prior zustand module singleton's
// single-instance-per-app behavior). `useRecordTableStore()` is a compatibility
// facade returning the full state + actions object for the coarse,
// single-instance consumers (header, filter bar, bulk bar, group row). The
// virtualized body uses the granular hooks (`useIsRowSelected`,
// `useIsCellEditing`) so a cell edit re-renders one cell, not the tbody.
//
// zustand deliberately does not appear in this directory (TW6 boundary lint).

import { atom, getDefaultStore, useAtomValue } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { useMemo } from 'react';
import type {
  RecordTableState,
  SortChip,
  FilterChip,
  GroupBySpec,
  CellEditState,
  SelectionMode,
} from './types';
import { DEFAULT_TABLE_STATE } from './types';

// ── Base atoms (one per state slice). Initialized from fresh copies of the
//    default so the shared default objects are never mutated. ──

export const columnOrderAtom = atom<string[]>([...DEFAULT_TABLE_STATE.columnOrder]);
export const columnVisibilityAtom = atom<Record<string, boolean>>({ ...DEFAULT_TABLE_STATE.columnVisibility });
export const columnWidthsAtom = atom<Record<string, number>>({ ...DEFAULT_TABLE_STATE.columnWidths });
export const sortsAtom = atom<SortChip[]>([...DEFAULT_TABLE_STATE.sorts]);
export const filtersAtom = atom<FilterChip[]>([...DEFAULT_TABLE_STATE.filters]);
export const groupByAtom = atom<GroupBySpec | null>(DEFAULT_TABLE_STATE.groupBy);
export const collapsedGroupsAtom = atom<Set<string>>(new Set(DEFAULT_TABLE_STATE.collapsedGroups));
export const selectionModeAtom = atom<SelectionMode>(DEFAULT_TABLE_STATE.selectionMode);
export const selectedIdsAtom = atom<Set<string>>(new Set(DEFAULT_TABLE_STATE.selectedIds));
export const editingCellAtom = atom<CellEditState | null>(DEFAULT_TABLE_STATE.editingCell);
export const cursorAtom = atom<string | null>(DEFAULT_TABLE_STATE.cursor);
export const hasMoreAtom = atom<boolean>(DEFAULT_TABLE_STATE.hasMore);
export const isLoadingAtom = atom<boolean>(DEFAULT_TABLE_STATE.isLoading);

// ── Granular derived families for the hot per-row / per-cell paths ──

const cellKey = (rowId: string, field: string): string => `${rowId} ${field}`;

/** Per-row selected flag: recomputes on any selection change, but only rows
 *  whose boolean actually flips re-render (Jotai bails on Object.is-equal). */
export const isRowSelectedFamily = atomFamily((id: string) =>
  atom((get) => get(selectedIdsAtom).has(id)),
);

/** Per-cell editing flag, keyed by "rowId field". */
export const isCellEditingFamily = atomFamily((key: string) =>
  atom((get) => {
    const editing = get(editingCellAtom);
    return editing ? cellKey(editing.rowId, editing.field) === key : false;
  }),
);

/** True only while this row is selected. */
export function useIsRowSelected(id: string): boolean {
  return useAtomValue(isRowSelectedFamily(id));
}

/** True only while this exact cell is being edited. */
export function useIsCellEditing(rowId: string, field: string): boolean {
  return useAtomValue(isCellEditingFamily(cellKey(rowId, field)));
}

// ── Actions ──

export interface RecordTableActions {
  setColumnOrder: (order: string[]) => void;
  setColumnVisibility: (field: string, visible: boolean) => void;
  setColumnVisibilityMap: (map: Record<string, boolean>) => void;
  setColumnWidth: (field: string, width: number) => void;

  toggleSort: (field: string) => void;
  setSorts: (sorts: SortChip[]) => void;
  clearSorts: () => void;

  addFilter: (filter: FilterChip) => void;
  removeFilter: (id: string) => void;
  updateFilter: (id: string, patch: Partial<FilterChip>) => void;
  clearFilters: () => void;

  setGroupBy: (spec: GroupBySpec | null) => void;
  toggleGroupCollapsed: (groupKey: string) => void;

  setSelectionMode: (mode: SelectionMode) => void;
  toggleRowSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;

  startEditing: (state: CellEditState) => void;
  commitEditing: () => void;
  cancelEditing: () => void;

  setCursor: (cursor: string | null) => void;
  setHasMore: (hasMore: boolean) => void;
  setLoading: (loading: boolean) => void;

  reset: () => void;
}

export type RecordTableStore = RecordTableState & RecordTableActions;

const store = getDefaultStore();

/**
 * Stable action set, written through the default store. Because it holds no
 * atom subscriptions, using it never causes a re-render, and it is directly
 * callable in tests (no React needed).
 */
export const recordTableActions: RecordTableActions = {
  setColumnOrder: (order) => store.set(columnOrderAtom, order),
  setColumnVisibility: (field, visible) =>
    store.set(columnVisibilityAtom, (map) => ({ ...map, [field]: visible })),
  setColumnVisibilityMap: (map) =>
    store.set(columnVisibilityAtom, (prev) => ({ ...prev, ...map })),
  setColumnWidth: (field, width) =>
    store.set(columnWidthsAtom, (map) => ({ ...map, [field]: width })),

  toggleSort: (field) =>
    store.set(sortsAtom, (sorts) => {
      const existing = sorts.find((sc) => sc.field === field);
      if (!existing) return [...sorts, { field, direction: 'asc' as const }];
      if (existing.direction === 'asc') {
        return sorts.map((sc) =>
          sc.field === field ? { ...sc, direction: 'desc' as const } : sc,
        );
      }
      return sorts.filter((sc) => sc.field !== field);
    }),
  setSorts: (sorts) => store.set(sortsAtom, sorts),
  clearSorts: () => store.set(sortsAtom, []),

  addFilter: (filter) => store.set(filtersAtom, (filters) => [...filters, filter]),
  removeFilter: (id) => store.set(filtersAtom, (filters) => filters.filter((f) => f.id !== id)),
  updateFilter: (id, patch) =>
    store.set(filtersAtom, (filters) => filters.map((f) => (f.id === id ? { ...f, ...patch } : f))),
  clearFilters: () => store.set(filtersAtom, []),

  setGroupBy: (spec) => {
    store.set(groupByAtom, spec);
    store.set(collapsedGroupsAtom, new Set());
  },
  toggleGroupCollapsed: (groupKey) =>
    store.set(collapsedGroupsAtom, (prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    }),

  setSelectionMode: (mode) => store.set(selectionModeAtom, mode),
  toggleRowSelection: (id) =>
    store.set(selectedIdsAtom, (prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }),
  selectAll: (ids) => store.set(selectedIdsAtom, new Set(ids)),
  clearSelection: () => store.set(selectedIdsAtom, new Set()),

  startEditing: (state) => store.set(editingCellAtom, state),
  commitEditing: () => store.set(editingCellAtom, null),
  cancelEditing: () => store.set(editingCellAtom, null),

  setCursor: (cursor) => store.set(cursorAtom, cursor),
  setHasMore: (hasMore) => store.set(hasMoreAtom, hasMore),
  setLoading: (loading) => store.set(isLoadingAtom, loading),

  reset: () => {
    store.set(columnOrderAtom, [...DEFAULT_TABLE_STATE.columnOrder]);
    store.set(columnVisibilityAtom, { ...DEFAULT_TABLE_STATE.columnVisibility });
    store.set(columnWidthsAtom, { ...DEFAULT_TABLE_STATE.columnWidths });
    store.set(sortsAtom, [...DEFAULT_TABLE_STATE.sorts]);
    store.set(filtersAtom, [...DEFAULT_TABLE_STATE.filters]);
    store.set(groupByAtom, DEFAULT_TABLE_STATE.groupBy);
    store.set(collapsedGroupsAtom, new Set(DEFAULT_TABLE_STATE.collapsedGroups));
    store.set(selectionModeAtom, DEFAULT_TABLE_STATE.selectionMode);
    store.set(selectedIdsAtom, new Set(DEFAULT_TABLE_STATE.selectedIds));
    store.set(editingCellAtom, DEFAULT_TABLE_STATE.editingCell);
    store.set(cursorAtom, DEFAULT_TABLE_STATE.cursor);
    store.set(hasMoreAtom, DEFAULT_TABLE_STATE.hasMore);
    store.set(isLoadingAtom, DEFAULT_TABLE_STATE.isLoading);
  },
};

/** Stable action set. Provided as a hook for symmetry with the facade. */
export function useRecordTableActions(): RecordTableActions {
  return recordTableActions;
}

/**
 * Compatibility facade: the full state + actions object, for the coarse,
 * single-instance consumers. This subscribes to every base atom, so it is NOT
 * for the virtualized body (which uses the granular hooks above).
 */
export function useRecordTableStore(): RecordTableStore {
  const columnOrder = useAtomValue(columnOrderAtom);
  const columnVisibility = useAtomValue(columnVisibilityAtom);
  const columnWidths = useAtomValue(columnWidthsAtom);
  const sorts = useAtomValue(sortsAtom);
  const filters = useAtomValue(filtersAtom);
  const groupBy = useAtomValue(groupByAtom);
  const collapsedGroups = useAtomValue(collapsedGroupsAtom);
  const selectionMode = useAtomValue(selectionModeAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const editingCell = useAtomValue(editingCellAtom);
  const cursor = useAtomValue(cursorAtom);
  const hasMore = useAtomValue(hasMoreAtom);
  const isLoading = useAtomValue(isLoadingAtom);

  // Memoize so the facade object keeps a stable identity when no slice changed,
  // matching the prior single-store behavior (consumers depend on `store` in
  // effect deps). Actions are a module constant and need no dependency entry.
  return useMemo<RecordTableStore>(
    () => ({
      columnOrder,
      columnVisibility,
      columnWidths,
      sorts,
      filters,
      groupBy,
      collapsedGroups,
      selectionMode,
      selectedIds,
      editingCell,
      cursor,
      hasMore,
      isLoading,
      ...recordTableActions,
    }),
    [
      columnOrder,
      columnVisibility,
      columnWidths,
      sorts,
      filters,
      groupBy,
      collapsedGroups,
      selectionMode,
      selectedIds,
      editingCell,
      cursor,
      hasMore,
      isLoading,
    ],
  );
}
