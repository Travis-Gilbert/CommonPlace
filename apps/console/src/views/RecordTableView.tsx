'use client';

// SOURCING: @tanstack/react-table (tablecn structure: column defs + manual
// server-driven sorting/filtering) + @tanstack/react-virtual (row
// virtualization). The record.table descriptor (G6): fed by the block
// contract; sort and filter bind to ObjectQuery against the host (the data
// API seam), never to local demo state. Density is the --rec-* group: rows
// on the 4px grid, 8px cell padding, 32px utility column, the 0.1s
// background transition on every clickable row.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ObjectQuery, ObjectRef, ObjectSet, Predicate } from '@commonplace/block-view/types';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { useShellStore } from '@/lib/shell-store';
import { ViewState, type ViewStateKind } from './ViewStates';

// The per-hue ladder (TWENTY-APP-VALUES tag system): every hue exists as a
// tint surface plus an ink, both register tokens.
const TAG_HUES: Record<string, { tint: string; ink: string }> = {
  harness: { tint: 'var(--ij-gold-tint)', ink: 'var(--ij-gold)' },
  memory: { tint: 'var(--ij-memory-tint)', ink: 'var(--ij-memory)' },
  graph: { tint: 'var(--ij-graph-tint)', ink: 'var(--ij-graph)' },
  index: { tint: 'var(--ij-row-blue)', ink: 'var(--ij-link)' },
  publish: { tint: 'var(--ij-ok-bg)', ink: 'var(--ij-ok)' },
  agent: { tint: 'var(--ij-agent-tint)', ink: 'var(--ij-agent)' },
  room: { tint: 'var(--ij-room-tint)', ink: 'var(--ij-room)' },
};

const STATUS_HUES: Record<string, { tint: string; ink: string }> = {
  open: { tint: 'var(--ij-row-blue)', ink: 'var(--ij-link)' },
  processing: { tint: 'var(--ij-warn-bg)', ink: 'var(--ij-warn)' },
  settled: { tint: 'var(--ij-ok-bg)', ink: 'var(--ij-ok)' },
};

function Chip({ label, hue }: { label: string; hue?: { tint: string; ink: string } }) {
  return (
    <span
      className="inline-flex items-center rounded-ij-arc-underline px-2 leading-5"
      style={{
        background: hue?.tint ?? 'var(--ij-row-gray)',
        color: hue?.ink ?? 'var(--ij-ink-info)',
        transition: 'var(--rec-clickable-transition)',
      }}
    >
      {label}
    </span>
  );
}

interface RecordRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  updated: string;
  tags: readonly string[];
}

function toRow(object: ObjectRef): RecordRow {
  return {
    id: object.id,
    title: String(object.properties.title ?? ''),
    kind: String(object.properties.kind ?? ''),
    status: String(object.properties.status ?? ''),
    updated: String(object.properties.updated ?? ''),
    tags: Array.isArray(object.properties.tags) ? (object.properties.tags as string[]) : [],
  };
}

const columnHelper = createColumnHelper<RecordRow>();

// Column widths as layout classes on a shared flex row: the utility column is
// the --rec-* 32px token, the title takes the remaining measure, the rest are
// fixed. Density degrades by column visibility, not by squeezing: a narrow
// tool window shows the essential projection, a wide mount shows everything.
const COLUMN_CLASS: Record<string, string> = {
  utility: 'shrink-0 w-rec-utility-col',
  title: 'min-w-0 flex-1',
  kind: 'shrink-0 w-24',
  status: 'shrink-0 w-28',
  updated: 'shrink-0 w-24',
  tags: 'shrink-0 w-44',
};

// Fixed column widths in px (border-box, matching COLUMN_CLASS): a column is
// admitted only when the fixed set plus a readable title measure (160px)
// still fits, so the ladder can never crop a column mid-glyph at the pane
// edge. Status is the triage signal and survives to the floor; the utility
// checkbox drops before it.
const COL_W = { utility: 32, status: 112, kind: 96, updated: 96, tags: 176 } as const;
const TITLE_MIN = 160;

function visibilityFor(width: number): VisibilityState {
  const fits = (...cols: (keyof typeof COL_W)[]) =>
    width >= TITLE_MIN + cols.reduce((sum, col) => sum + COL_W[col], 0);
  const status = fits('status');
  const utility = status && fits('status', 'utility');
  const kind = utility && fits('status', 'utility', 'kind');
  const updated = kind && fits('status', 'utility', 'kind', 'updated');
  const tags = updated && fits('status', 'utility', 'kind', 'updated', 'tags');
  return { utility, status, kind, updated, tags };
}

export function RecordTableView({ set: initialSet, host }: ViewRenderProps) {
  const selectRecord = useShellStore((state) => state.selectRecord);
  const selectedRecordId = useShellStore((state) => state.selectedRecordId);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [result, setResult] = useState<ObjectSet>(initialSet);
  const [stateKind, setStateKind] = useState<ViewStateKind>('populated');

  // Server-driven sort and filter: state changes rebuild the ObjectQuery and
  // round-trip through the host. The table itself never sorts or filters.
  useEffect(() => {
    let active = true;
    setStateKind('loading');
    const predicates: Predicate[] = [];
    if (filterText) predicates.push({ kind: 'contains', field: 'title', value: filterText });
    if (statusFilter) predicates.push({ kind: 'eq', field: 'status', value: statusFilter });
    const query: ObjectQuery = {
      types: ['record'],
      where: predicates.length === 0 ? undefined : predicates.length === 1 ? predicates[0] : { kind: 'and', all: predicates },
      rank: sorting[0]
        ? [{ kind: 'field', field: sorting[0].id, direction: sorting[0].desc ? 'desc' : 'asc' }]
        : undefined,
      live: true,
    };
    Promise.resolve(host.query(query))
      .then((next) => {
        if (!active) return;
        setResult(next);
        setStateKind(next.objects.length === 0 ? 'empty' : 'populated');
      })
      .catch(() => {
        if (active) setStateKind('error');
      });
    return () => {
      active = false;
    };
  }, [host, sorting, filterText, statusFilter]);

  const rows = useMemo(() => result.objects.map(toRow), [result]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'utility',
        size: 32,
        header: () => null,
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.title}`}
            checked={selectedRecordId === row.original.id}
            onChange={() => selectRecord(selectedRecordId === row.original.id ? null : row.original.id)}
            className="accent-ij-accent"
          />
        ),
      }),
      columnHelper.accessor('title', { header: 'Title' }),
      columnHelper.accessor('kind', {
        header: 'Kind',
        cell: (info) => <Chip label={info.getValue()} hue={TAG_HUES[info.getValue()] ?? undefined} />,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <Chip label={info.getValue()} hue={STATUS_HUES[info.getValue()]} />,
      }),
      columnHelper.accessor('updated', {
        header: 'Updated',
        cell: (info) => <span className="font-ij-mono text-ij-ink-info">{info.getValue()}</span>,
      }),
      columnHelper.accessor('tags', {
        header: 'Tags',
        enableSorting: false,
        cell: (info) => (
          <span className="flex gap-rec-sibling-gap">
            {info.getValue().map((tag) => (
              <Chip key={tag} label={tag} hue={TAG_HUES[tag]} />
            ))}
          </span>
        ),
      }),
    ],
    [selectRecord, selectedRecordId],
  );

  // Density degrades by column visibility (the essential projection first),
  // driven by the mount's real width: a 24 percent tool window shows
  // utility + title + status; an editor-wide mount shows every column.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => visibilityFor(320));
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setColumnVisibility(visibilityFor(width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowModel = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rowModel.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 12,
  });

  if (stateKind === 'error') {
    return <ViewState state="error" errorMessage="Record query failed." onRetry={() => setSorting([...sorting])} />;
  }

  return (
    <div ref={containerRef} tabIndex={-1} className="flex h-full flex-col bg-ij-chrome outline-none" data-records-state={stateKind}>
      <div className="flex h-ij-toolbar shrink-0 items-center gap-2 border-b border-ij-seam px-2">
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter records"
          aria-label="Filter records by title"
          className="h-ij-control min-w-0 flex-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-rec-cell-pad text-ij-ink placeholder:text-ij-ink-disabled focus:outline-2 focus:outline-ij-accent"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter records by status"
          className="h-ij-control shrink-0 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
        >
          <option value="">All</option>
          <option value="open">open</option>
          <option value="processing">processing</option>
          <option value="settled">settled</option>
        </select>
        <span className="shrink-0 whitespace-nowrap font-ij-mono text-ij-ink-info">{rows.length}</span>
      </div>
      {stateKind === 'empty' ? (
        <ViewState state="empty" />
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ fontWeight: 'var(--rec-weight-regular)' }}>
            <thead className="sticky top-0 z-10 bg-ij-chrome">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="flex w-full items-center border-b border-ij-seam">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`h-8 px-rec-cell-pad text-left leading-8 text-ij-ink-info ${COLUMN_CLASS[header.column.id] ?? ''}`}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 hover:text-ij-ink"
                          style={{ transition: 'var(--rec-clickable-transition)', fontWeight: 'var(--rec-weight-medium)' }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' ? '↑' : header.column.getIsSorted() === 'desc' ? '↓' : ''}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody style={{ height: virtualizer.getTotalSize() }} className="relative">
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rowModel[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    tabIndex={-1}
                    data-record-id={row.original.id}
                    data-selected={selectedRecordId === row.original.id ? 'true' : undefined}
                    onClick={() => selectRecord(row.original.id)}
                    className="absolute left-0 top-0 flex w-full cursor-default items-center overflow-hidden border-b border-ij-seam hover:bg-ij-hover-surface data-[selected]:bg-ij-selection"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                      height: 32,
                      transition: 'var(--rec-clickable-transition)',
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`overflow-hidden text-ellipsis whitespace-nowrap px-rec-cell-pad ${COLUMN_CLASS[cell.column.id] ?? ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
