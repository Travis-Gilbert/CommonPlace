// RecordTable — TW2 data grid component.
// Renders any ObjectShape through the view registry using @tanstack/react-table
// for column management and @tanstack/react-virtual for windowing.
//
// Features in order: sticky header → type icons → column resize → sort/filter
// → reorder/hide → inline edit → keyboard nav → group-by → selection → virtual scroll
//
// Usage:
//   <RecordTable objectSet={set} host={blockHost} />

'use client';

import { useCallback, useEffect, useMemo, useRef, type FC } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';
import type { ObjectSet, BlockHost, ObjectRef } from '@/lib/block-view/types';
import { useRecordTableStore } from './record-table-store';
import { applyFilters } from './record-filter';
import { columnsFromShape, type ColumnMeta } from './types';
import { RecordTableHeader } from './RecordTableHeader';
import { RecordTableBody } from './RecordTableBody';
import { RecordTableFilterBar } from './RecordTableFilterBar';
import { RecordTableBulkBar } from './RecordTableBulkBar';
import styles from './record-table.module.css';

export interface RecordTableProps {
  objectSet: ObjectSet;
  host: BlockHost;
}

export const RecordTable: FC<RecordTableProps> = ({ objectSet, host }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const store = useRecordTableStore();

  // Derive column metadata from shape, using first object for type inference
  const columnMeta = useMemo<ColumnMeta[]>(() => {
    if (!objectSet.shape.fields.length) return [];
    const sample = objectSet.objects[0] as ObjectRef | undefined;
    return columnsFromShape(objectSet.shape, sample);
  }, [objectSet.shape, objectSet.objects]);

  // Initialize column state from store on first render
  useEffect(() => {
    if (!store.columnOrder.length && columnMeta.length) {
      store.setColumnOrder(columnMeta.map((c) => c.id));
      const vis: Record<string, boolean> = {};
      const widths: Record<string, number> = {};
      for (const c of columnMeta) {
        vis[c.id] = true;
        widths[c.id] = c.defaultWidth;
      }
      store.setColumnVisibilityMap(vis);
      // Set widths individually
      for (const [k, v] of Object.entries(widths)) {
        store.setColumnWidth(k, v);
      }
    }
  }, [columnMeta, store]);

  // Build @tanstack/react-table columns
  const tableColumns = useMemo<ColumnDef<ObjectRef>[]>(() => {
    return columnMeta.map((meta): ColumnDef<ObjectRef> => ({
      id: meta.id,
      accessorKey: meta.id,
      header: () => (
        <span className="rt-header-cell">
          <span className="rt-type-icon">{meta.typeIcon}</span>
          <span>{meta.label}</span>
        </span>
      ),
      cell: ({ row }) => {
        const value = row.original.properties[meta.id];
        return (
          <span className="rt-cell" data-field={meta.id} data-type={meta.propType}>
            {renderCellValue(value)}
          </span>
        );
      },
      size: meta.defaultWidth,
      minSize: meta.minWidth,
      enableSorting: true,
      enableColumnFilter: true,
      enableHiding: meta.hideable,
    }));
  }, [columnMeta]);

  // Build sort state for tanstack from store. When grouping, the group field is
  // the primary sort so each group's rows stay contiguous; user sorts apply within.
  const tableSorting = useMemo<SortingState>(() => {
    const base = store.sorts.map((s) => ({ id: s.field, desc: s.direction === 'desc' }));
    const groupField = store.groupBy?.field;
    if (!groupField) return base;
    return [{ id: groupField, desc: false }, ...base.filter((s) => s.id !== groupField)];
  }, [store.sorts, store.groupBy]);

  // Filter as a pure pre-pass so FilterChip operators are honored (crit 5).
  const filteredObjects = useMemo(
    () => applyFilters(objectSet.objects as ObjectRef[], store.filters),
    [objectSet.objects, store.filters],
  );

  // Table instance
  const table = useReactTable({
    data: filteredObjects,
    columns: tableColumns,
    state: {
      sorting: tableSorting,
      columnVisibility: store.columnVisibility,
      columnOrder: store.columnOrder,
    },
    onSortingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(tableSorting) : updater;
      const groupField = store.groupBy?.field;
      store.setSorts(
        next
          .filter((s) => s.id !== groupField)
          .map((s) => ({
            field: s.id,
            direction: s.desc ? 'desc' : 'asc',
          })),
      );
    },
    onColumnOrderChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(store.columnOrder) : updater;
      store.setColumnOrder(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: store.selectionMode !== 'none',
    onRowSelectionChange: () => {},
  });

  const hasSelection = store.selectedIds.size > 0;
  const objects = objectSet.objects as ObjectRef[];

  if (!objects.length && !store.isLoading) {
    return (
      <div className={styles['rt-empty']} role="status">
        <div className={styles['rt-empty-icon']}>📋</div>
        <p className={styles['rt-empty-text']}>No records yet</p>
        <p className={styles['rt-empty-hint']}>Create your first record to get started.</p>
      </div>
    );
  }

  if (store.isLoading && !objects.length) {
    return (
      <div className={styles['rt-loading']} role="status" aria-label="Loading records">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={styles['rt-skeleton-row']} aria-hidden="true">
            {columnMeta.slice(0, 4).map((c) => (
              <div key={c.id} className={styles['rt-skeleton-cell']} style={{ width: c.defaultWidth }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`${styles['rt-root']} porcelain`}>
      <RecordTableFilterBar columns={columnMeta} />
      <div className={styles['rt-table-container']} ref={containerRef}>
        <table className={styles['rt-table']} role="grid" aria-label="Record table">
          <RecordTableHeader table={table} columnMeta={columnMeta} />
          <RecordTableBody
            table={table}
            columnMeta={columnMeta}
            containerRef={containerRef}
            host={host}
          />
        </table>
      </div>
      {hasSelection && (
        <RecordTableBulkBar count={store.selectedIds.size} host={host} />
      )}
    </div>
  );
};

// ── Helpers ──

function renderCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
