'use client';

import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  FileText,
  Link2,
  Mic,
  SquareCheck,
  CircleHelp,
  TriangleAlert,
  CalendarClock,
  NotebookPen,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { indexRowKey, type IndexRow, type IndexRowKind } from '@/lib/commonplace/index-queries';
import { fieldPresenceOf, type LensProps } from '@/lib/v2/lenses/types';
import { TagChip } from '@/components/v2/TagChip';

/* Table lens: the same filed rows as a sortable table (TanStack Table, the
   engine tnks-data-table is built on), themed to the register. Columns are
   derived from the data's field presence, so the table adapts to what the bound
   rows actually carry rather than showing a fixed, half-empty schema. */

const KIND_GLYPH: Record<IndexRowKind, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  link: Link2,
  voice: Mic,
  task: SquareCheck,
  question: CircleHelp,
  tension: TriangleAlert,
  event: CalendarClock,
  note: NotebookPen,
};

const TH =
  'border-b border-cr-hairline bg-cr-ground px-cr-2 py-cr-1 text-left font-cr-mono text-cr-caption ' +
  'uppercase tracking-[0.06em] text-cr-ink-3';

export function TableLens({ rows, selectedKey, onSelect, destinationFor }: LensProps) {
  const fields = useMemo(() => fieldPresenceOf(rows, destinationFor), [rows, destinationFor]);

  const columns = useMemo<ColumnDef<IndexRow>[]>(() => {
    const cols: ColumnDef<IndexRow>[] = [
      {
        id: 'kind',
        header: 'Kind',
        accessorKey: 'kind',
        size: 96,
        cell: (info) => {
          const kind = info.getValue<IndexRowKind>();
          const Glyph = KIND_GLYPH[kind] ?? FileText;
          return (
            <span className="inline-flex items-center gap-cr-1 font-cr-mono text-cr-caption uppercase text-cr-ink-3">
              <Glyph className="size-[13px]" />
              {kind}
            </span>
          );
        },
      },
      {
        id: 'title',
        header: 'Title',
        accessorKey: 'title',
        cell: (info) => (
          <span className="block max-w-[42ch] truncate text-cr-body text-cr-ink">
            {info.getValue<string>()}
          </span>
        ),
      },
    ];
    if (fields.hasDestination) {
      cols.push({
        id: 'destination',
        header: 'Filed to',
        // Override-aware: an inspector Refile or a Board drag updates this column
        // immediately, so the Table agrees with the rest of the composition.
        accessorFn: (r) => destinationFor(r)?.label ?? '',
        cell: (info) => <span className="text-cr-ink-2">{info.getValue<string>()}</span>,
      });
    }
    if (fields.hasDate) {
      cols.push({
        id: 'when',
        header: 'When',
        accessorFn: (r) => r.when ?? '',
        cell: (info) => (
          <span className="font-cr-mono text-cr-caption tabular-nums text-cr-ink-2">
            {info.getValue<string>()}
          </span>
        ),
      });
    }
    if (fields.hasTags) {
      cols.push({
        id: 'tags',
        header: 'Tags',
        // Sort/search on the joined text, but render each tag as its own hued chip.
        accessorFn: (r) => r.tags.join(', '),
        enableSorting: false,
        cell: (info) => {
          const tags = info.row.original.tags;
          if (tags.length === 0) return null;
          return (
            <span className="flex flex-wrap gap-cr-1">
              {tags.map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </span>
          );
        },
      });
    }
    return cols;
  }, [fields, destinationFor]);

  // The same item can land in more than one band (recent and open both); a table
  // of items shows it once, so dedupe by id here (the Stream keeps it per band).
  const data = useMemo(() => {
    const seen = new Set<string>();
    const out: IndexRow[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    return out;
  }, [rows]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-cr-surface px-cr-3 text-center text-cr-small text-cr-ink-3">
        Nothing matches. Clear the filter, or widen the search.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto bg-cr-surface">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-[1]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th key={header.id} style={{ width: header.getSize() }} className={TH}>
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-cr-1 uppercase text-cr-ink-3 transition-colors duration-chrome hover:text-cr-ink-2 focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-1"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === 'asc' && <ChevronUp className="size-[12px]" aria-hidden="true" />}
                      {sorted === 'desc' && (
                        <ChevronDown className="size-[12px]" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => {
            const key = indexRowKey(r.original);
            const selected = key === selectedKey;
            return (
              <tr
                key={r.id}
                aria-selected={selected}
                onClick={() => onSelect(key)}
                className="cursor-pointer border-b border-cr-hairline transition-colors duration-chrome ease-cr hover:bg-cr-top aria-selected:bg-cr-top"
              >
                {r.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-cr-2 py-cr-2 align-middle text-cr-small text-cr-ink-2"
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
  );
}
