// Virtualized table body with keyboard navigation, inline editing, group-by
// row rendering, and action emission via BlockHost.
//
// TW6: row and cell state is consumed through granular Jotai hooks, not the
// coarse store facade. Each RecordRow subscribes only to its own selected flag
// and each RecordCell only to its own editing flag, so selecting a row or
// editing a cell re-renders that row/cell, not the whole tbody. The body itself
// subscribes only to the structural atoms (columns, grouping) that change
// rarely.
'use client';

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { flexRender, type Table, type Row } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAtomValue, getDefaultStore } from 'jotai';
import type { JsonValue, ObjectRef, BlockHost } from '@/lib/block-view/types';
import type { ColumnMeta } from './types';
import {
  recordTableActions as actions,
  useIsRowSelected,
  useIsCellEditing,
  columnVisibilityAtom,
  columnWidthsAtom,
  selectionModeAtom,
  groupByAtom,
  collapsedGroupsAtom,
  editingCellAtom,
} from './record-table-store';
import { RecordTableGroupRow } from './RecordTableGroupRow';
import styles from './record-table.module.css';

interface RecordTableBodyProps {
  table: Table<ObjectRef>;
  columnMeta: ColumnMeta[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  host: BlockHost;
}

const ROW_HEIGHT = 40; // px, matches the porcelain table row height

export const RecordTableBody: FC<RecordTableBodyProps> = ({
  table,
  columnMeta,
  containerRef,
  host,
}) => {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [isClient, setIsClient] = useState(false);

  // Structural subscriptions only (change rarely; never selection or editing).
  const columnVisibility = useAtomValue(columnVisibilityAtom);
  const columnWidths = useAtomValue(columnWidthsAtom);
  const selectionMode = useAtomValue(selectionModeAtom);
  const groupBy = useAtomValue(groupByAtom);
  const collapsedGroups = useAtomValue(collapsedGroupsAtom);

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

  // ── Keyboard navigation. focusCell scrolls the target row into view (for the
  //    windowed case) then focuses the cell whose td carries both data-row and
  //    data-field. Both attributes live on the same td (the prior bug put
  //    data-row on the tr, so the selector never matched). ──
  const focusCell = useCallback(
    (rowIdx: number, field: string) => {
      virtualizer.scrollToIndex(rowIdx, { align: 'auto' });
      requestAnimationFrame(() => {
        const el = bodyRef.current?.querySelector(
          `[data-row="${rowIdx}"][data-field="${field}"]`,
        ) as HTMLElement | null;
        el?.focus();
      });
    },
    [virtualizer],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, field: string) => {
      const visibleFields = columnMeta.filter((c) => columnVisibility[c.id] !== false);
      const fieldIdx = visibleFields.findIndex((c) => c.id === field);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (rowIdx < rows.length - 1) focusCell(rowIdx + 1, field);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (rowIdx > 0) focusCell(rowIdx - 1, field);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (fieldIdx < visibleFields.length - 1) focusCell(rowIdx, visibleFields[fieldIdx + 1].id);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (fieldIdx > 0) focusCell(rowIdx, visibleFields[fieldIdx - 1].id);
          break;
        case 'Enter': {
          e.preventDefault();
          // Match the double-click path: only editable fields open an editor.
          const meta = columnMeta.find((c) => c.id === field);
          if (!meta?.editable) break;
          const row = rows[rowIdx];
          if (!row) break;
          const value = row.original.properties[field];
          actions.startEditing({
            rowId: row.original.id,
            field,
            value: value != null ? String(value) : '',
          });
          break;
        }
        case 'Escape':
          e.preventDefault();
          actions.cancelEditing();
          break;
      }
    },
    [rows, columnMeta, columnVisibility, focusCell],
  );

  // Per-group counts for the group headers (crit 6).
  const groupCounts = useMemo(() => {
    const field = groupBy?.field;
    if (!field) return null;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = String(row.original.properties[field] ?? '');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [rows, groupBy]);

  const renderRow = (row: Row<ObjectRef>, index: number, isVirtual: boolean, virtualStart?: number) => (
    <RecordRow
      key={row.id}
      row={row}
      rowIndex={index}
      columnMeta={columnMeta}
      columnWidths={columnWidths}
      selectionMode={selectionMode}
      host={host}
      isVirtual={isVirtual}
      virtualStart={virtualStart}
      onKeyDown={handleKeyDown}
    />
  );

  // Grouped view: headers interleave with rows, and a collapsed group shows only
  // its header. This path renders directly (not windowed): a grouped view
  // collapses to few visible rows, while the windowed path below stays for the
  // flat large-list case (the 60fps path).
  if (groupBy?.field) {
    const field = groupBy.field;
    const items: React.ReactNode[] = [];
    let lastGroup: string | undefined;
    (rows as Row<ObjectRef>[]).forEach((row, index) => {
      const value = String(row.original.properties[field] ?? '');
      if (value !== lastGroup) {
        lastGroup = value;
        items.push(
          <RecordTableGroupRow
            key={`group-${value}`}
            label={value}
            count={groupCounts?.get(value) ?? 0}
            depth={0}
            collapsed={collapsedGroups.has(value)}
            onToggle={() => actions.toggleGroupCollapsed(value)}
          />,
        );
      }
      if (!collapsedGroups.has(value)) items.push(renderRow(row, index, false));
    });
    return (
      <tbody className={styles['rt-tbody']} ref={bodyRef}>
        {items}
      </tbody>
    );
  }

  return (
    <tbody className={styles['rt-tbody']} ref={bodyRef}>
      {/* SSR fallback: render all rows without virtualization */}
      {!isClient &&
        (rows as Row<ObjectRef>[]).map((row, index) => renderRow(row, index, false))}

      {/* Client-side: virtualized rendering */}
      {isClient && (
        <>
          {virtualRows.length > 0 && (
            <tr style={{ height: virtualizer.getTotalSize() }}>
              <td colSpan={columnMeta.length + (selectionMode !== 'none' ? 1 : 0)} />
            </tr>
          )}
          {virtualRows.map((virtualRow) =>
            renderRow(
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

// ── Row ──

interface RecordRowProps {
  row: Row<ObjectRef>;
  rowIndex: number;
  columnMeta: ColumnMeta[];
  columnWidths: Record<string, number>;
  selectionMode: string;
  host: BlockHost;
  isVirtual: boolean;
  virtualStart?: number;
  onKeyDown: (e: React.KeyboardEvent, rowIdx: number, field: string) => void;
}

const RecordRow: FC<RecordRowProps> = memo(function RecordRow({
  row,
  rowIndex,
  columnMeta,
  columnWidths,
  selectionMode,
  host,
  isVirtual,
  virtualStart,
  onKeyDown,
}) {
  const isSelected = useIsRowSelected(row.original.id);

  const rowStyle = isVirtual
    ? {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: ROW_HEIGHT,
        transform: `translateY(${virtualStart ?? rowIndex * ROW_HEIGHT}px)`,
      }
    : undefined;

  const rowClass = isSelected
    ? `${styles['rt-tr']} ${styles['rt-tr--selected']}`
    : styles['rt-tr'];

  return (
    <Fragment>
      <tr className={rowClass} style={rowStyle}>
        {selectionMode !== 'none' && (
          <td className={`${styles['rt-td']} ${styles['rt-td-checkbox']}`} style={{ width: 32 }}>
            <input
              type="checkbox"
              className={styles['rt-checkbox']}
              checked={isSelected}
              onChange={() => actions.toggleRowSelection(row.original.id)}
              aria-label={`Select row ${row.original.id}`}
            />
          </td>
        )}
        {row.getVisibleCells().map((cell) => {
          const meta = columnMeta.find((c) => c.id === cell.column.id);
          if (!meta) return null;
          return (
            <RecordCell
              key={cell.id}
              rowId={row.original.id}
              rowIndex={rowIndex}
              field={cell.column.id}
              meta={meta}
              width={columnWidths[cell.column.id] ?? meta.defaultWidth}
              rawValue={row.original.properties[cell.column.id]}
              host={host}
              onKeyDown={onKeyDown}
              renderStatic={() => flexRender(cell.column.columnDef.cell, cell.getContext())}
            />
          );
        })}
      </tr>
    </Fragment>
  );
});

// ── Cell ──

interface RecordCellProps {
  rowId: string;
  rowIndex: number;
  field: string;
  meta: ColumnMeta;
  width: number;
  rawValue: JsonValue | undefined;
  host: BlockHost;
  onKeyDown: (e: React.KeyboardEvent, rowIdx: number, field: string) => void;
  renderStatic: () => React.ReactNode;
}

const RecordCell: FC<RecordCellProps> = memo(function RecordCell({
  rowId,
  rowIndex,
  field,
  meta,
  width,
  rawValue,
  host,
  onKeyDown,
  renderStatic,
}) {
  const isEditing = useIsCellEditing(rowId, field);

  const tdClass = isEditing
    ? `${styles['rt-td']} ${styles['rt-td--editing']}`
    : styles['rt-td'];

  return (
    <td
      className={tdClass}
      style={{ width }}
      data-row={rowIndex}
      data-field={field}
      tabIndex={0}
      role="gridcell"
      onKeyDown={(e) => onKeyDown(e, rowIndex, field)}
      onDoubleClick={() => {
        if (!meta.editable) return;
        actions.startEditing({
          rowId,
          field,
          value: rawValue != null ? String(rawValue) : '',
        });
      }}
    >
      {isEditing ? (
        <CellEditor rowId={rowId} field={field} meta={meta} host={host} />
      ) : (
        renderStatic()
      )}
    </td>
  );
});

// ── Cell editor (mounted only for the one editing cell, so it is the only
//    subscriber to the editing value atom) ──

interface CellEditorProps {
  rowId: string;
  field: string;
  meta: ColumnMeta;
  host: BlockHost;
}

const CellEditor: FC<CellEditorProps> = ({ rowId, field, meta, host }) => {
  const editing = useAtomValue(editingCellAtom);
  const value = editing && editing.rowId === rowId && editing.field === field ? editing.value : '';

  const commit = useCallback(() => {
    // Read the live atom, not the render closure: the boolean checkbox fires
    // onChange then onCommit in one synchronous handler, so `editing` from this
    // render still holds the pre-toggle value. getDefaultStore is the same store
    // the actions write through.
    const current = getDefaultStore().get(editingCellAtom);
    if (!current) return;
    const patch: Record<string, JsonValue> = {};
    if (meta.propType === 'number' || meta.propType === 'integer' || meta.propType === 'timestamp_ms') {
      const n = parseFloat(current.value);
      patch[field] = Number.isNaN(n) ? current.value : n;
    } else if (meta.propType === 'boolean') {
      patch[field] = current.value === 'true';
    } else {
      patch[field] = current.value;
    }
    void Promise.resolve(host.emit({ kind: 'update', id: rowId, patch }))
      .then((result) => {
        if (result.ok) actions.commitEditing();
        else actions.cancelEditing();
      })
      .catch(() => actions.cancelEditing());
  }, [meta.propType, field, rowId, host]);

  return (
    <InlineEdit
      value={value}
      propType={meta.propType}
      onChange={(v) => actions.startEditing({ rowId, field, value: v })}
      onCommit={commit}
      onCancel={() => actions.cancelEditing()}
    />
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
    const el = inputRef.current;
    el?.focus();
    // Only text/number inputs support text selection; date/checkbox throw.
    if (el && (el.type === 'text' || el.type === 'number')) el.select();
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

  // Boolean: a real checkbox (toggles then commits).
  if (propType === 'boolean') {
    return (
      <input
        ref={inputRef}
        type="checkbox"
        className={styles['rt-checkbox']}
        checked={value === 'true'}
        onChange={(e) => {
          onChange(e.target.checked ? 'true' : 'false');
          onCommit();
        }}
        onKeyDown={handleKeyDown}
        aria-label="Toggle value"
      />
    );
  }

  // Timestamp (ms epoch): a date input.
  if (propType === 'timestamp_ms') {
    return (
      <input
        ref={inputRef}
        type="date"
        className={styles['rt-inline-input']}
        value={msToDateInput(value)}
        onChange={(e) => onChange(dateInputToMs(e.target.value))}
        onBlur={onCommit}
        onKeyDown={handleKeyDown}
      />
    );
  }

  const isNumber = propType === 'number' || propType === 'integer';
  return (
    <input
      ref={inputRef}
      className={styles['rt-inline-input']}
      type={isNumber ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
    />
  );
};

/** Milliseconds-since-epoch string to a yyyy-mm-dd value for a date input. */
function msToDateInput(value: string): string {
  const ms = Number.parseInt(value, 10);
  if (Number.isNaN(ms)) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  // Format from local date parts (not toISOString, which is UTC and shifts the
  // day for non-UTC offsets).
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A yyyy-mm-dd date-input value back to a milliseconds-since-epoch string. */
function dateInputToMs(dateStr: string): string {
  if (!dateStr) return '';
  // Parse as local midnight (new Date(y, m-1, d)); Date.parse of a bare date is
  // UTC and would round-trip to the wrong local day.
  const [y, m, d] = dateStr.split('-').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return '';
  const ms = new Date(y, m - 1, d).getTime();
  return Number.isNaN(ms) ? '' : String(ms);
}
