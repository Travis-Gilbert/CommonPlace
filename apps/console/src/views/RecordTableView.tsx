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
      columnHelper.accessor('title', { header: 'Title', size: 420 }),
      columnHelper.accessor('kind', {
        header: 'Kind',
        size: 110,
        cell: (info) => <Chip label={info.getValue()} hue={TAG_HUES[info.getValue()] ?? undefined} />,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        size: 120,
        cell: (info) => <Chip label={info.getValue()} hue={STATUS_HUES[info.getValue()]} />,
      }),
      columnHelper.accessor('updated', { header: 'Updated', size: 110 }),
      columnHelper.accessor('tags', {
        header: 'Tags',
        size: 200,
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

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
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
    <div className="flex h-full flex-col bg-ij-chrome" data-records-state={stateKind}>
      <div className="flex h-ij-toolbar shrink-0 items-center gap-2 border-b border-ij-seam px-2">
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter records"
          aria-label="Filter records by title"
          className="h-ij-control w-56 rounded-ij-arc border border-ij-control-border bg-ij-editor px-rec-cell-pad text-ij-ink placeholder:text-ij-ink-disabled focus:outline-2 focus:outline-ij-accent"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter records by status"
          className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
        >
          <option value="">All statuses</option>
          <option value="open">open</option>
          <option value="processing">processing</option>
          <option value="settled">settled</option>
        </select>
        <span className="ml-auto text-ij-ink-info">{rows.length} records</span>
      </div>
      {stateKind === 'empty' ? (
        <ViewState state="empty" />
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ fontWeight: 'var(--rec-weight-regular)' }}>
            <thead className="sticky top-0 z-10 bg-ij-chrome">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-ij-seam">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="h-8 px-rec-cell-pad text-left text-ij-ink-info"
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
                    data-selected={selectedRecordId === row.original.id ? 'true' : undefined}
                    onClick={() => selectRecord(row.original.id)}
                    className="absolute left-0 top-0 flex w-full cursor-default items-center border-b border-ij-seam hover:bg-ij-hover-surface data-[selected]:bg-ij-selection"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                      height: 32,
                      transition: 'var(--rec-clickable-transition)',
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="overflow-hidden text-ellipsis whitespace-nowrap px-rec-cell-pad"
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
