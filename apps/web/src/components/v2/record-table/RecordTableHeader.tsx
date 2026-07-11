// Sticky table header with type-iconed columns, resize handles, sort indicators,
// and column visibility toggle.

'use client';

import { useCallback, useRef, useState, useEffect, type FC } from 'react';
import { type Table } from '@tanstack/react-table';
import type { ObjectRef } from '@/lib/block-view/types';
import type { ColumnMeta } from './types';
import { useRecordTableStore } from './record-table-store';
import styles from './record-table.module.css';

interface RecordTableHeaderProps {
  table: Table<ObjectRef>;
  columnMeta: ColumnMeta[];
}

export const RecordTableHeader: FC<RecordTableHeaderProps> = ({ table, columnMeta }) => {
  const store = useRecordTableStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dragSrc, setDragSrc] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleSort = useCallback(
    (field: string) => {
      store.toggleSort(field);
    },
    [store],
  );

  const handleResizeStart = useCallback(
    (field: string, event: React.MouseEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = store.columnWidths[field] ?? 160;

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        const newWidth = Math.max(columnMeta.find((c) => c.id === field)?.minWidth ?? 80, startWidth + delta);
        store.setColumnWidth(field, newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [store, columnMeta],
  );

  // ── Drag-to-reorder ──

  const handleDragStart = useCallback(
    (e: React.DragEvent, field: string) => {
      setDragSrc(field);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', field);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, field: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragSrc && dragSrc !== field) {
        setDragOver(field);
      }
    },
    [dragSrc],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetField: string) => {
      e.preventDefault();
      if (!dragSrc || dragSrc === targetField) {
        setDragSrc(null);
        setDragOver(null);
        return;
      }
      // Reorder columns
      const order = [...store.columnOrder];
      const srcIdx = order.indexOf(dragSrc);
      const tgtIdx = order.indexOf(targetField);
      if (srcIdx === -1 || tgtIdx === -1) return;
      order.splice(srcIdx, 1);
      order.splice(tgtIdx, 0, dragSrc);
      store.setColumnOrder(order);
      setDragSrc(null);
      setDragOver(null);
    },
    [dragSrc, store],
  );

  const handleDragEnd = useCallback(() => {
    setDragSrc(null);
    setDragOver(null);
  }, []);

  return (
    <thead className={styles['rt-thead']}>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} className={styles['rt-tr-header']}>
          {store.selectionMode !== 'none' && (
            <th className={`${styles['rt-th']} ${styles['rt-th-checkbox']}`} style={{ width: 32 }}>
              <input
                type="checkbox"
                className={styles['rt-checkbox']}
                aria-label="Select all rows"
                onChange={(e) => {
                  if (e.target.checked) {
                    const allIds = table.getRowModel().rows.map((r) => r.original.id);
                    store.selectAll(allIds);
                  } else {
                    store.clearSelection();
                  }
                }}
                checked={
                  table.getRowModel().rows.length > 0 &&
                  table.getRowModel().rows.every((r) => store.selectedIds.has(r.original.id))
                }
              />
            </th>
          )}
          {headerGroup.headers.map((header) => {
            const meta = columnMeta.find((c) => c.id === header.id);
            if (!meta) return null;
            const sortState = store.sorts.find((s) => s.field === header.id);
            const width = store.columnWidths[header.id] ?? meta.defaultWidth;

            const thClass = sortState
              ? `${styles['rt-th']} ${styles['rt-th--sorted']}`
              : styles['rt-th'];

            return (
              <th
                key={header.id}
                className={thClass}
                style={{ width, minWidth: meta.minWidth }}
                draggable
                onDragStart={(e) => handleDragStart(e, header.id)}
                onDragOver={(e) => handleDragOver(e, header.id)}
                onDrop={(e) => handleDrop(e, header.id)}
                onDragEnd={handleDragEnd}
                data-dragging={dragSrc === header.id ? 'true' : undefined}
                data-drag-over={dragOver === header.id ? 'true' : undefined}
              >
                <button
                  className={styles['rt-th-btn']}
                  onClick={() => handleSort(header.id)}
                  aria-sort={
                    sortState
                      ? sortState.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span className={styles['rt-type-icon']} aria-hidden="true">
                    {meta.typeIcon}
                  </span>
                  <span className={styles['rt-th-label']}>{meta.label}</span>
                  {sortState && (
                    <span className={styles['rt-sort-icon']} aria-hidden="true">
                      {sortState.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
                <div
                  className={styles['rt-resize-handle']}
                  onMouseDown={(e) => handleResizeStart(header.id, e)}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${meta.label} column`}
                />
              </th>
            );
          })}
          {/* Column visibility toggle */}
          <th className={`${styles['rt-th']} ${styles['rt-th-menu']}`} style={{ width: 40 }}>
            <div ref={menuRef} className={styles['rt-vis-menu-wrapper']}>
              <button
                className={styles['rt-vis-menu-btn']}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Toggle column visibility"
                aria-expanded={menuOpen}
              >
                ⋮
              </button>
              {menuOpen && (
                <div className={styles['rt-vis-dropdown']} role="menu">
                  {columnMeta
                    .filter((c) => c.hideable)
                    .map((c) => {
                      const visible = store.columnVisibility[c.id] !== false;
                      return (
                        <label
                          key={c.id}
                          className={styles['rt-vis-item']}
                          role="menuitemcheckbox"
                          aria-checked={visible}
                        >
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={() => store.setColumnVisibility(c.id, !visible)}
                          />
                          <span className={styles['rt-type-icon']} aria-hidden="true">{c.typeIcon}</span>
                          <span>{c.label}</span>
                        </label>
                      );
                    })}
                </div>
              )}
            </div>
          </th>
        </tr>
      ))}
    </thead>
  );
};
