'use client';

/* Screen archetype: Airtable/Linear table (SPEC-UX-PHYSICS D8, see
   docs/plans/ux-physics-accent/archetypes.md). The table is the whole surface; sort
   by any column; the Glide Data Grid scale engine is reserved for millions of rows.

   Ledger (Data): the tabular book on the desk. Every Item is a row; sort by any
   column. Rendered with TanStack Table (already installed, porcelain-native HTML).
   The IA reserves Glide Data Grid as the production engine for scale (millions of
   rows, canvas, in-cell editing); it is installed and swaps in once the repo's
   workspace module-resolution is sorted.

   Data is the real ObjectQuery item list via commonplace-api.fetchItems (local-first
   through useApiData's persisted cache, SPEC-UX-PHYSICS D2). The five-state discipline
   (D4) runs through ViewStateView: a cold, empty library renders an honest empty, not
   a populated-looking seed. Sorting and the porcelain skin are data-agnostic. */

import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { fetchItems, useApiData } from '@/lib/commonplace-api';
import type { ItemGql } from '@/lib/commonplace-graphql';
import { deriveViewState } from '@/lib/commonplace-view-state';
import { narrationFor } from '@/lib/commonplace-wait-narration';
import { ViewStateView } from '@/components/commonplace/shared/ViewStateView';
import { refiledLabel, useRefileSignal } from '@/lib/commonplace/index-queries';
import styles from './ledger.module.css';

type Row = {
  id: string;
  kind: string;
  title: string;
  tags: string;
  collection: string;
  created: string;
  validFrom: string;
};

/** One epoch-ms field to a YYYY-MM-DD cell, blank (not a dash) when absent. */
function isoDay(ms?: number | null): string {
  return ms ? new Date(ms).toISOString().slice(0, 10) : '';
}

/** Map a real ObjectQuery item to a Ledger row. */
function itemToRow(item: ItemGql): Row {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title || 'Untitled',
    tags: item.tags.join(', '),
    collection: item.collections[0] ?? '',
    created: isoDay(item.createdAtMs),
    validFrom: isoDay(item.validFromMs),
  };
}

const col = createColumnHelper<Row>();

function Tags({ value }: { value: string }) {
  const tags = value.split(',').map((t) => t.trim()).filter(Boolean);
  return (
    <>
      {tags.map((t) => (
        <span key={t} className={styles.tag}>{t}</span>
      ))}
    </>
  );
}

const columns = [
  col.accessor('title', { header: 'Title', cell: (c) => <span className={styles.title}>{c.getValue()}</span> }),
  col.accessor('kind', { header: 'Kind', cell: (c) => <span className={styles.pill}>{c.getValue()}</span> }),
  col.accessor('tags', { header: 'Tags', enableSorting: false, cell: (c) => <Tags value={c.getValue()} /> }),
  col.accessor('collection', { header: 'Collection' }),
  col.accessor('created', { header: 'Created', cell: (c) => <span className={styles.mono}>{c.getValue()}</span> }),
  col.accessor('validFrom', { header: 'Valid from', cell: (c) => <span className={`${styles.mono} ${styles.dim}`}>{c.getValue()}</span> }),
];

const CARET: Record<string, string> = { asc: ' ↑', desc: ' ↓' };

export default function LedgerPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const { data: items, loading, error, refetch } = useApiData<ItemGql[]>(
    () => fetchItems(),
    [],
    { cacheKey: 'v2:ledger:items' },
  );

  // Live refile corrections from any surface (e.g. the Index) move an item's
  // Collection cell here immediately, matched by id or title. Overlaid on the
  // fetched rows so a correction survives a background revalidation.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  useRefileSignal((signal) => {
    setOverrides((prev) => {
      const next = { ...prev, [signal.id]: signal.label };
      if (signal.title) next[signal.title] = signal.label;
      return next;
    });
  });

  const rows = useMemo<Row[]>(() => {
    if (!items) return [];
    return items.map((item) => {
      const base = itemToRow(item);
      const label = overrides[base.id] ?? overrides[base.title] ?? refiledLabel(base.id, base.title);
      return label ? { ...base, collection: label } : base;
    });
  }, [items, overrides]);

  const state = deriveViewState<Row[]>({
    data: items ? rows : null,
    loading,
    error: error?.message ?? null,
    retry: refetch,
    isEmpty: (r) => r.length === 0,
  });

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Data / Tables</div>
          <h1 className="p-h1">Tables</h1>
        </div>
        <div className="p-cmd">
          <span>Search or command</span>
          <span className="p-kbd">&#8984;K</span>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={styles.frame}>
          <ViewStateView state={state} label="table items" narration={narrationFor('reading', 0)}>
            {() => (
              <table className={styles.table}>
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th
                          key={h.id}
                          className={styles.th}
                          onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                          style={{ cursor: h.column.getCanSort() ? 'pointer' : 'default' }}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <span className={styles.caret}>{CARET[h.column.getIsSorted() as string] ?? ''}</span>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((r) => (
                    <tr key={r.id} className={styles.row}>
                      {r.getVisibleCells().map((c) => (
                        <td key={c.id} className={styles.td}>
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ViewStateView>
        </div>
      </div>
    </>
  );
}
