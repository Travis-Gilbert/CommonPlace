// Record table store unit tests (TW6, Jotai): sorting, filtering, selection,
// column management, editing state transitions, and the granular per-row /
// per-cell derived families.

import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import {
  recordTableActions as actions,
  columnOrderAtom,
  columnVisibilityAtom,
  columnWidthsAtom,
  sortsAtom,
  filtersAtom,
  groupByAtom,
  collapsedGroupsAtom,
  selectionModeAtom,
  selectedIdsAtom,
  editingCellAtom,
  cursorAtom,
  hasMoreAtom,
  isLoadingAtom,
  isRowSelectedFamily,
  isCellEditingFamily,
} from '@/components/v2/record-table/record-table-store';

const store = getDefaultStore();

describe('record-table-store (Jotai)', () => {
  beforeEach(() => {
    actions.reset();
  });

  describe('column management', () => {
    it('sets column order', () => {
      actions.setColumnOrder(['id', 'title', 'status']);
      expect(store.get(columnOrderAtom)).toEqual(['id', 'title', 'status']);
    });

    it('sets column visibility', () => {
      actions.setColumnVisibility('title', false);
      expect(store.get(columnVisibilityAtom).title).toBe(false);
    });

    it('sets column visibility map for bulk updates', () => {
      actions.setColumnVisibilityMap({ id: true, title: true, status: false });
      const vis = store.get(columnVisibilityAtom);
      expect(vis.id).toBe(true);
      expect(vis.title).toBe(true);
      expect(vis.status).toBe(false);
    });

    it('sets column width', () => {
      actions.setColumnWidth('title', 300);
      expect(store.get(columnWidthsAtom).title).toBe(300);
    });
  });

  describe('sorting', () => {
    it('toggles: none -> asc -> desc -> none', () => {
      actions.toggleSort('title');
      expect(store.get(sortsAtom)).toEqual([{ field: 'title', direction: 'asc' }]);
      actions.toggleSort('title');
      expect(store.get(sortsAtom)).toEqual([{ field: 'title', direction: 'desc' }]);
      actions.toggleSort('title');
      expect(store.get(sortsAtom)).toEqual([]);
    });

    it('supports multi-column sort', () => {
      actions.toggleSort('title');
      actions.toggleSort('status');
      expect(store.get(sortsAtom)).toHaveLength(2);
    });

    it('clears all sorts', () => {
      actions.toggleSort('title');
      actions.toggleSort('status');
      actions.clearSorts();
      expect(store.get(sortsAtom)).toEqual([]);
    });

    it('sets sorts in bulk via setSorts', () => {
      actions.setSorts([
        { field: 'title', direction: 'asc' },
        { field: 'id', direction: 'desc' },
      ]);
      expect(store.get(sortsAtom)).toEqual([
        { field: 'title', direction: 'asc' },
        { field: 'id', direction: 'desc' },
      ]);
    });
  });

  describe('reordering', () => {
    it('reorders columns via setColumnOrder', () => {
      actions.setColumnOrder(['title', 'status', 'id']);
      expect(store.get(columnOrderAtom)).toEqual(['title', 'status', 'id']);
    });
  });

  describe('filtering', () => {
    it('adds and removes filters', () => {
      actions.addFilter({ id: 'f1', field: 'status', op: 'eq', value: 'active' });
      actions.addFilter({ id: 'f2', field: 'count', op: 'gt', value: '10' });
      expect(store.get(filtersAtom)).toHaveLength(2);
      actions.removeFilter('f1');
      expect(store.get(filtersAtom)).toHaveLength(1);
      expect(store.get(filtersAtom)[0].id).toBe('f2');
    });

    it('updates a filter', () => {
      actions.addFilter({ id: 'f1', field: 'status', op: 'eq', value: 'active' });
      actions.updateFilter('f1', { value: 'inactive' });
      expect(store.get(filtersAtom)[0].value).toBe('inactive');
    });

    it('clears all filters', () => {
      actions.addFilter({ id: 'f1', field: 'status', op: 'eq', value: 'active' });
      actions.clearFilters();
      expect(store.get(filtersAtom)).toEqual([]);
    });
  });

  describe('selection', () => {
    it('toggles single row selection', () => {
      actions.toggleRowSelection('row-1');
      expect(store.get(selectedIdsAtom).has('row-1')).toBe(true);
      actions.toggleRowSelection('row-1');
      expect(store.get(selectedIdsAtom).has('row-1')).toBe(false);
    });

    it('selects all rows', () => {
      actions.selectAll(['row-1', 'row-2', 'row-3']);
      expect(store.get(selectedIdsAtom).size).toBe(3);
    });

    it('clears selection', () => {
      actions.selectAll(['row-1', 'row-2']);
      actions.clearSelection();
      expect(store.get(selectedIdsAtom).size).toBe(0);
    });

    it('sets selection mode', () => {
      actions.setSelectionMode('single');
      expect(store.get(selectionModeAtom)).toBe('single');
    });
  });

  describe('editing', () => {
    it('tracks editing cell', () => {
      actions.startEditing({ rowId: 'row-1', field: 'title', value: 'Hello' });
      expect(store.get(editingCellAtom)).toEqual({ rowId: 'row-1', field: 'title', value: 'Hello' });
    });

    it('cancels editing', () => {
      actions.startEditing({ rowId: 'row-1', field: 'title', value: 'Hello' });
      actions.cancelEditing();
      expect(store.get(editingCellAtom)).toBeNull();
    });

    it('commits editing', () => {
      actions.startEditing({ rowId: 'row-1', field: 'title', value: 'Hello' });
      actions.commitEditing();
      expect(store.get(editingCellAtom)).toBeNull();
    });
  });

  describe('grouping', () => {
    it('sets group-by spec', () => {
      actions.setGroupBy({ field: 'status', expanded: true });
      expect(store.get(groupByAtom)).toEqual({ field: 'status', expanded: true });
    });

    it('toggles group collapsed state', () => {
      actions.setGroupBy({ field: 'status', expanded: true });
      actions.toggleGroupCollapsed('active');
      expect(store.get(collapsedGroupsAtom).has('active')).toBe(true);
      actions.toggleGroupCollapsed('active');
      expect(store.get(collapsedGroupsAtom).has('active')).toBe(false);
    });
  });

  describe('loading and pagination', () => {
    it('sets loading state', () => {
      actions.setLoading(true);
      expect(store.get(isLoadingAtom)).toBe(true);
    });

    it('sets cursor and hasMore', () => {
      actions.setCursor('next-page-token');
      actions.setHasMore(false);
      expect(store.get(cursorAtom)).toBe('next-page-token');
      expect(store.get(hasMoreAtom)).toBe(false);
    });
  });

  describe('granular families (TW6)', () => {
    it('isRowSelectedFamily reflects only the toggled row', () => {
      actions.selectAll(['row-1']);
      expect(store.get(isRowSelectedFamily('row-1'))).toBe(true);
      expect(store.get(isRowSelectedFamily('row-2'))).toBe(false);
    });

    it('isCellEditingFamily reflects only the editing cell', () => {
      actions.startEditing({ rowId: 'row-1', field: 'title', value: 'x' });
      expect(store.get(isCellEditingFamily('row-1 title'))).toBe(true);
      expect(store.get(isCellEditingFamily('row-1 status'))).toBe(false);
      expect(store.get(isCellEditingFamily('row-2 title'))).toBe(false);
    });
  });

  describe('reset', () => {
    it('restores default state', () => {
      actions.toggleSort('title');
      actions.addFilter({ id: 'f1', field: 'status', op: 'eq', value: 'active' });
      actions.toggleRowSelection('row-1');
      actions.startEditing({ rowId: 'row-1', field: 'title', value: 'Hello' });

      actions.reset();
      expect(store.get(sortsAtom)).toEqual([]);
      expect(store.get(filtersAtom)).toEqual([]);
      expect(store.get(selectedIdsAtom).size).toBe(0);
      expect(store.get(editingCellAtom)).toBeNull();
    });
  });
});
