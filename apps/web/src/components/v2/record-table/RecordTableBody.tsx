// Virtualized table body with keyboard navigation, inline editing,
// group-by row rendering, and action emission via BlockHost.
'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { flexRender, type Table, type Row } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { JsonValue, ObjectRef, BlockHost } from '@/lib/block-view/types';
import type { ColumnMeta } from './types';
import { useRecordTableStore } from './record-table-store';
import { RecordTableGroupRow } from './RecordTableGroupRow';
import styles from './record-table.module.css';

interface RecordTableBodyProps {
  table: Table<ObjectRef>;
  columnMeta: ColumnMeta[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  host: BlockHost;
}

const ROW_HEIGHT = 40; // px — matches Twenty's table row height

export const RecordTableBody: FC<RecordTableBodyProps> = ({
  table,
  columnMeta,
  containerRef,
  host,
}) => {
  const store = useRecordTableStore();
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = isClient ? virtualizer.getVirtualItems() : [];

  // Keyboard navigation
  const focusedCellRef = useRef<{ rowIdx: number; field: string } | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, field: string) => {
      const visibleFields = columnMeta.filter((c) => store.columnVisibility[c.id] !== false);
      const fieldIdx = visibleFields.findIndex((c) => c.id === field);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (rowIdx < rows.length - 1) {
            focusCell(rowIdx + 1, field);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (rowIdx > 0) {
            focusCell(rowIdx - 1, field);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (fieldIdx < visibleFields.length - 1) {
            focusCell(rowIdx, visibleFields[fieldIdx + 1].id);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (fieldIdx > 0) {
            focusCell(rowIdx, visibleFields[fieldIdx - 1].id);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (!store.editingCell) {
            const row = rows[rowIdx];
            const value = row.original.properties[field];
            store.startEditing({
              rowId: row.original.id,
              field,
              value: value != null ? String(value) : '',
            });
          }
          break;
        case 'Escape':
          if (store.editingCell) {
            e.preventDefault();
            store.cancelEditing();
          }
          break;
        case 'Tab':
          // Let natural tab order work, but close editing
          if (store.editingCell) {
            store.commitEditing();
          }
          break;
      }
    },
    [rows, columnMeta, store],
  );

  const focusCell = (rowIdx: number, field: string) => {
    focusedCellRef.current = { rowIdx, field };
    const el = document.querySelector(`[data-row="${rowIdx}"][data-field="${field}"]`) as HTMLElement;
    el?.focus();
  };

  // Emit object update action on edit commit
  const handleCommitEditing = useCallback(() => {
    const edit = store.editingCell;
    if (!edit) return;
    const patch: Record<string, JsonValue> = {};
    // Parse to match propType if possible
    const meta = columnMeta.find((c) => c.id === edit.field);
    if (meta?.propType === 'number' || meta?.propType === 'integer') {
      const n = parseFloat(edit.value);
      patch[edit.field] = isNaN(n) ? edit.value : n;
    } else if (meta?.propType === 'boolean') {
      patch[edit.field] = edit.value === 'true';
    } else {
      patch[edit.field] = edit.value;
    }
    host
      .emit({ kind: 'update', id: edit.rowId, patch })
      .then(() => store.commitEditing())
      .catch((err) => {
        console.error('RecordTable: update action failed', err);
        store.cancelEditing();
      });
  }, [store, host, columnMeta]);

  // Selection handling with group awareness
  const handleRowSelect = useCallback(
    (id: string, e: React.MouseEvent | React.ChangeEvent) => {
      const isShift =
        'shiftKey' in e && (e as React.MouseEvent).shiftKey && store.selectionMode === 'multi';
      if (isShift) {
        store.toggleRowSelection(id);
      } else if ((e.target as HTMLElement).tagName === 'INPUT') {
        store.toggleRowSelection(id);
      }
    },
    [store],
  );

  // ── Shared row renderer (used by both SSR fallback and client virtualized) ──
  const renderTableRow = useCallback(
    (row: Row<ObjectRef>, index: number, isVirtual: boolean, virtualStart?: number) => {
      const isSelected = store.selectedIds.has(row.original.id);

      const groupField = store.groupBy?.field;
      const prevRow = index > 0 ? (rows[index - 1] as Row<ObjectRef>) : null;
      const prevGroupValue =
        groupField && prevRow ? String(prevRow.original.properties[groupField] ?? '') : undefined;
      const thisGroupValue = groupField
        ? String(row.original.properties[groupField] ?? '')
        : undefined;
      const showGroupRow =
        groupField && thisGroupValue !== undefined && prevGroupValue !== thisGroupValue;

      const rowClass = isSelected
        ? `${styles['rt-tr']} ${styles['rt-tr--selected']}`
        : styles['rt-tr'];

      // Only apply absolute positioning when virtualized (client-side)
      const rowStyle = isVirtual
        ? {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width: '100%',
            height: ROW_HEIGHT,
            transform: `translateY(${virtualStart ?? index * ROW_HEIGHT}px)`,
          }
        : undefined;

      return (
        <Fragment key={row.id}>
          {showGroupRow && (
            <RecordTableGroupRow
              label={thisGroupValue!}
              count={0}
              depth={0}
              collapsed={store.collapsedGroups.has(thisGroupValue!)}
              onToggle={() => store.toggleGroupCollapsed(thisGroupValue!)}
            />
          )}
          <tr
            data-row={isVirtual ? virtualStart : index}
            className={rowClass}
            style={rowStyle}
            onClick={(e) => handleRowSelect(row.original.id, e)}
          >
            {store.selectionMode !== 'none' && (
              <td
                className={`${styles['rt-td']} ${styles['rt-td-checkbox']}`}
                style={{ width: 32 }}
              >
                <input
                  type="checkbox"
                  className={styles['rt-checkbox']}
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    store.toggleRowSelection(row.original.id);
                  }}
                  aria-label={`Select row ${row.original.id}`}
                />
              </td>
            )}
            {row.getVisibleCells().map((cell) => {
              const meta = columnMeta.find((c) => c.id === cell.column.id);
              if (!meta) return null;
              const isEditing =
                store.editingCell?.rowId === row.original.id &&
                store.editingCell?.field === cell.column.id;

              const tdClass = isEditing
                ? `${styles['rt-td']} ${styles['rt-td--editing']}`
                : styles['rt-td'];

              return (
                <td
                  key={cell.id}
                  className={tdClass}
                  style={{
                    width: store.columnWidths[cell.column.id] ?? meta.defaultWidth,
                  }}
                  data-field={cell.column.id}
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyDown(e, index, cell.column.id!)}
                  onDoubleClick={() => {
                    const value = row.original.properties[cell.column.id!];
                    store.startEditing({
                      rowId: row.original.id,
                      field: cell.column.id!,
                      value: value != null ? String(value) : '',
                    });
                  }}
                  role="gridcell"
                >
                  {isEditing ? (
                    <InlineEdit
                      value={store.editingCell!.value}
                      propType={meta.propType}
                      onChange={(v) => {
                        store.startEditing({
                          rowId: row.original.id,
                          field: cell.column.id!,
                          value: v,
                        });
                      }}
                      onCommit={handleCommitEditing}
                      onCancel={() => store.cancelEditing()}
                    />
                  ) : (
                    flexRender(cell.column.columnDef.cell, cell.getContext())
                  )}
                </td>
              );
            })}
          </tr>
        </Fragment>
      );
    },
    [store, columnMeta, rows, handleKeyDown, handleRowSelect, handleCommitEditing],
  );

  return (
    <tbody className={styles['rt-tbody']} ref={bodyRef}>
      {/* SSR fallback: render all rows without virtualization */}
      {!isClient &&
        (rows as Row<ObjectRef>[]).map((row, index) =>
          renderTableRow(row, index, false),
        )}

      {/* Client-side: virtualized rendering */}
      {isClient && (
        <>
          {virtualRows.length > 0 && (
            <tr style={{ height: virtualizer.getTotalSize() }}>
              <td
                colSpan={
                  columnMeta.length + (store.selectionMode !== 'none' ? 1 : 0)
                }
              />
            </tr>
          )}
          {virtualRows.map((virtualRow) =>
            renderTableRow(
              rows[virtualRow.index] as Row<ObjectRef>,
              virtualRow.index,
              true,
              virtualRow.start,
            ),
          )}
        </>
      )}
    </tbody>
  );
};

// ── Inline Edit Component ──

interface InlineEditProps {
  value: string;
  propType: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

const InlineEdit: FC<InlineEditProps> = ({ value, propType, onChange, onCommit, onCancel }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  if (propType === 'boolean') {
    return (
      <select
        className={`${styles['rt-inline-input']} ${styles['rt-inline-select']}`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onCommit();
        }}
        onKeyDown={handleKeyDown}
        ref={inputRef as any}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (propType === 'number' || propType === 'integer') {
    return (
      <input
        ref={inputRef}
        className={styles['rt-inline-input']}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      className={styles['rt-inline-input']}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
    />
  );
};
