// Zustand store for record table state.
// Manages column config, sorting, filtering, grouping, selection, editing,
// and pagination for the TW2 record table.

import { create } from 'zustand';
import type {
  RecordTableState,
  SortChip,
  FilterChip,
  GroupBySpec,
  CellEditState,
  SelectionMode,
} from './types';
import { DEFAULT_TABLE_STATE } from './types';

export interface RecordTableActions {
  // Column management
  setColumnOrder: (order: string[]) => void;
  setColumnVisibility: (field: string, visible: boolean) => void;
  setColumnVisibilityMap: (map: Record<string, boolean>) => void;
  setColumnWidth: (field: string, width: number) => void;

  // Sorting
  toggleSort: (field: string) => void;
  setSorts: (sorts: SortChip[]) => void;
  clearSorts: () => void;

  // Filtering
  addFilter: (filter: FilterChip) => void;
  removeFilter: (id: string) => void;
  updateFilter: (id: string, patch: Partial<FilterChip>) => void;
  clearFilters: () => void;

  // Grouping
  setGroupBy: (spec: GroupBySpec | null) => void;
  toggleGroupCollapsed: (groupKey: string) => void;

  // Selection
  setSelectionMode: (mode: SelectionMode) => void;
  toggleRowSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;

  // Editing
  startEditing: (state: CellEditState) => void;
  commitEditing: () => void;
  cancelEditing: () => void;

  // Pagination
  setCursor: (cursor: string | null) => void;
  setHasMore: (hasMore: boolean) => void;

  // Loading
  setLoading: (loading: boolean) => void;

  // Bulk reset
  reset: () => void;
}

export type RecordTableStore = RecordTableState & RecordTableActions;

export const useRecordTableStore = create<RecordTableStore>((set, get) => ({
  ...structuredClone(DEFAULT_TABLE_STATE),

  setColumnOrder: (order) => set({ columnOrder: order }),

  setColumnVisibility: (field, visible) =>
    set((s) => ({
      columnVisibility: { ...s.columnVisibility, [field]: visible },
    })),

  setColumnVisibilityMap: (map) =>
    set((s) => ({
      columnVisibility: { ...s.columnVisibility, ...map },
    })),

  setColumnWidth: (field, width) =>
    set((s) => ({
      columnWidths: { ...s.columnWidths, [field]: width },
    })),

  toggleSort: (field) =>
    set((s) => {
      const existing = s.sorts.find((sc) => sc.field === field);
      if (!existing) {
        return { sorts: [...s.sorts, { field, direction: 'asc' }] };
      }
      if (existing.direction === 'asc') {
        return {
          sorts: s.sorts.map((sc) =>
            sc.field === field ? { ...sc, direction: 'desc' as const } : sc,
          ),
        };
      }
      return { sorts: s.sorts.filter((sc) => sc.field !== field) };
    }),

  setSorts: (sorts) => set({ sorts }),

  clearSorts: () => set({ sorts: [] }),

  addFilter: (filter) =>
    set((s) => ({ filters: [...s.filters, filter] })),

  removeFilter: (id) =>
    set((s) => ({ filters: s.filters.filter((f) => f.id !== id) })),

  updateFilter: (id, patch) =>
    set((s) => ({
      filters: s.filters.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),

  clearFilters: () => set({ filters: [] }),

  setGroupBy: (spec) => set({ groupBy: spec, collapsedGroups: new Set() }),

  toggleGroupCollapsed: (groupKey) =>
    set((s) => {
      const next = new Set(s.collapsedGroups);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return { collapsedGroups: next };
    }),

  setSelectionMode: (mode) => set({ selectionMode: mode }),

  toggleRowSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),

  clearSelection: () => set({ selectedIds: new Set() }),

  startEditing: (state) => set({ editingCell: state }),

  commitEditing: () => set({ editingCell: null }),

  cancelEditing: () => set({ editingCell: null }),

  setCursor: (cursor) => set({ cursor }),

  setHasMore: (hasMore) => set({ hasMore }),

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () => set(structuredClone(DEFAULT_TABLE_STATE)),
}));
