// Record table store unit tests: sorting, filtering, selection,
// column management, editing state transitions.

import { describe, it, expect, beforeEach } from 'vitest';
import { useRecordTableStore } from '@/components/v2/record-table/record-table-store';

function freshStore() {
  // Reset before each test
  useRecordTableStore.getState().reset();
  return useRecordTableStore.getState();
}

describe('record-table-store', () => {
  beforeEach(() => {
    useRecordTableStore.getState().reset();
  });

  describe('column management', () => {
    it('sets column order', () => {
      const store = useRecordTableStore.getState();
      store.setColumnOrder(['id', 'title', 'status']);
      expect(useRecordTableStore.getState().columnOrder).toEqual(['id', 'title', 'status']);
    });

    it('sets column visibility', () => {
      const store = useRecordTableStore.getState();
      store.setColumnVisibility('title', false);
      expect(useRecordTableStore.getState().columnVisibility.title).toBe(false);
    });

    it('sets column visibility map for bulk updates', () => {
      const store = useRecordTableStore.getState();
      store.setColumnVisibilityMap({ id: true, title: true, status: false });
      const vis = useRecordTableStore.getState().columnVisibility;
      expect(vis.id).toBe(true);
      expect(vis.title).toBe(true);
      expect(vis.status).toBe(false);
    });

    it('sets column width', () => {
      const store = useRecordTableStore.getState();
      store.setColumnWidth('title', 300);
      expect(useRecordTableStore.getState().columnWidths.title).toBe(300);
    });
  });

  describe('sorting', () => {
    it('toggles: none → asc → desc → none', () => {
      const store = useRecordTableStore.getState();

      store.toggleSort('title');
      expect(useRecordTableStore.getState().sorts).toEqual([
        { field: 'title', direction: 'asc' },
      ]);

      store.toggleSort('title');
      expect(useRecordTableStore.getState().sorts).toEqual([
        { field: 'title', direction: 'desc' },
      ]);

      store.toggleSort('title');
      expect(useRecordTableStore.getState().sorts).toEqual([]);
    });

    it('supports multi-column sort', () => {
      let store = useRecordTableStore.getState();
      store.toggleSort('title'); // asc
      store = useRecordTableStore.getState();
      store.toggleSort('status'); // asc
      expect(useRecordTableStore.getState().sorts).toHaveLength(2);
    });

    it('clears all sorts', () => {
      let store = useRecordTableStore.getState();
      store.toggleSort('title');
      store = useRecordTableStore.getState();
      store.toggleSort('status');
      store.clearSorts();
      expect(useRecordTableStore.getState().sorts).toEqual([]);
    });

    it('sets sorts in bulk via setSorts', () => {
      const store = useRecordTableStore.getState();
      store.setSorts([
        { field: 'title', direction: 'asc' as const },
        { field: 'id', direction: 'desc' as const },
      ]);
      expect(useRecordTableStore.getState().sorts).toEqual([
        { field: 'title', direction: 'asc' },
        { field: 'id', direction: 'desc' },
      ]);
    });
  });

  describe('reordering', () => {
    it('reorders columns via setColumnOrder', () => {
      const store = useRecordTableStore.getState();
      store.setColumnOrder(['title', 'status', 'id']);
      expect(useRecordTableStore.getState().columnOrder).toEqual(['title', 'status', 'id']);
    });
  });

  describe('filtering', () => {
    it('adds and removes filters', () => {
      let store = useRecordTableStore.getState();
      store.addFilter({ id: 'f1', field: 'status', op: 'eq', value: 'active' });
      store = useRecordTableStore.getState();
      store.addFilter({ id: 'f2', field: 'count', op: 'gt', value: '10' });

      expect(useRecordTableStore.getState().filters).toHaveLength(2);

      store.removeFilter('f1');
      expect(useRecordTableStore.getState().filters).toHaveLength(1);
      expect(useRecordTableStore.getState().filters[0].id).toBe('f2');
    });

    it('updates a filter', () => {
      let store = useRecordTableStore.getState();
      store.addFilter({ id: 'f1', field: 'status', op: 'eq', value: 'active' });
      store = useRecordTableStore.getState();
      store.updateFilter('f1', { value: 'inactive' });
      expect(useRecordTableStore.getState().filters[0].value).toBe('inactive');
    });

    it('clears all filters', () => {
      let store = useRecordTableStore.getState();
      store.addFilter({ id: 'f1', field: 'status', op: 'eq', value: 'active' });
      store.clearFilters();
      expect(useRecordTableStore.getState().filters).toEqual([]);
    });
  });

  describe('selection', () => {
    it('toggles single row selection', () => {
      let store = useRecordTableStore.getState();
      store.toggleRowSelection('row-1');
      expect(useRecordTableStore.getState().selectedIds.has('row-1')).toBe(true);
      store = useRecordTableStore.getState();
      store.toggleRowSelection('row-1');
      expect(useRecordTableStore.getState().selectedIds.has('row-1')).toBe(false);
    });

    it('selects all rows', () => {
      let store = useRecordTableStore.getState();
      store.selectAll(['row-1', 'row-2', 'row-3']);
      expect(useRecordTableStore.getState().selectedIds.size).toBe(3);
    });

    it('clears selection', () => {
      let store = useRecordTableStore.getState();
      store.selectAll(['row-1', 'row-2']);
      store.clearSelection();
      expect(useRecordTableStore.getState().selectedIds.size).toBe(0);
    });

    it('sets selection mode', () => {
      let store = useRecordTableStore.getState();
      store.setSelectionMode('single');
      expect(useRecordTableStore.getState().selectionMode).toBe('single');
    });
  });

  describe('editing', () => {
    it('tracks editing cell', () => {
      let store = useRecordTableStore.getState();
      store.startEditing({ rowId: 'row-1', field: 'title', value: 'Hello' });
      expect(useRecordTableStore.getState().editingCell).toEqual({
        rowId: 'row-1',
        field: 'title',
        value: 'Hello',
      });
    });

    it('cancels editing', () => {
      let store = useRecordTableStore.getState();
      store.startEditing({ rowId: 'row-1', field: 'title', value: 'Hello' });
      store.cancelEditing();
      expect(useRecordTableStore.getState().editingCell).toBeNull();
    });

    it('commits editing (placeholder)', () => {
      let store = useRecordTableStore.getState();
      store.startEditing({ rowId: 'row-1', field: 'title', value: 'Hello' });
      store.commitEditing();
      expect(useRecordTableStore.getState().editingCell).toBeNull();
    });
  });

  describe('grouping', () => {
    it('sets group-by spec', () => {
      let store = useRecordTableStore.getState();
      store.setGroupBy({ field: 'status', expanded: true });
      expect(useRecordTableStore.getState().groupBy).toEqual({
        field: 'status',
        expanded: true,
      });
    });

    it('toggles group collapsed state', () => {
      let store = useRecordTableStore.getState();
      store.setGroupBy({ field: 'status', expanded: true });
      store.toggleGroupCollapsed('active');
      expect(useRecordTableStore.getState().collapsedGroups.has('active')).toBe(true);
      store.toggleGroupCollapsed('active');
      expect(useRecordTableStore.getState().collapsedGroups.has('active')).toBe(false);
    });
  });

  describe('loading and pagination', () => {
    it('sets loading state', () => {
      let store = useRecordTableStore.getState();
      store.setLoading(true);
      expect(useRecordTableStore.getState().isLoading).toBe(true);
    });

    it('sets cursor and hasMore', () => {
      let store = useRecordTableStore.getState();
      store.setCursor('next-page-token');
      store.setHasMore(false);
      expect(useRecordTableStore.getState().cursor).toBe('next-page-token');
      expect(useRecordTableStore.getState().hasMore).toBe(false);
    });
  });

  describe('reset', () => {
    it('restores default state', () => {
      let store = useRecordTableStore.getState();
      store.toggleSort('title');
      store.addFilter({ id: 'f1', field: 'status', op: 'eq', value: 'active' });
      store.toggleRowSelection('row-1');
      store.startEditing({ rowId: 'row-1', field: 'title', value: 'Hello' });

      store.reset();
      const s = useRecordTableStore.getState();
      expect(s.sorts).toEqual([]);
      expect(s.filters).toEqual([]);
      expect(s.selectedIds.size).toBe(0);
      expect(s.editingCell).toBeNull();
    });
  });
});
