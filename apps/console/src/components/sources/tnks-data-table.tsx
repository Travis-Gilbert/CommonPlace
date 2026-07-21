'use client';

// SOURCING: jacksonkasi1/tnks-data-table (MIT) structure on
// @tanstack/react-table + @tanstack/react-virtual. The records table view
// already mounts this pattern; this module is the shared shell for column
// chrome, density, and virtual scroller so B9 can point ViewSource here.
// ViewSource: package jacksonkasi1/tnks-data-table, component DataTable,
// mode wrap, regime css-vars.

import { flexRender, type Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { cn } from '@/lib/cn';

export type TnksDataTableProps<TData> = {
  readonly table: Table<TData>;
  readonly estimateRowHeight?: number;
  readonly className?: string;
  readonly onRowClick?: (rowId: string) => void;
  readonly selectedRowId?: string | null;
};

export function TnksDataTable<TData>({
  table,
  estimateRowHeight = 32,
  className,
  onRowClick,
  selectedRowId,
}: TnksDataTableProps<TData>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 12,
  });

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-chrome',
        className,
      )}
    >
      <div className="flex border-b border-ij-seam bg-ij-editor">
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div
              key={header.id}
              className="h-8 px-rec-cell-pad text-left leading-8 text-ij-ink-info"
              style={{ width: header.getSize() }}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </div>
          )),
        )}
      </div>
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            const selected = selectedRowId === row.id;
            return (
              <div
                key={row.id}
                role="row"
                data-selected={selected || undefined}
                className={cn(
                  'absolute left-0 top-0 flex w-full cursor-default items-center overflow-hidden hover:bg-ij-hover-surface data-[selected]:bg-ij-selection',
                )}
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                  transition: 'var(--rec-clickable-transition)',
                }}
                onClick={() => onRowClick?.(row.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className="truncate px-rec-cell-pad text-ij-ink"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
