'use client';

/* Ledger (Data): the tabular book on the desk. Every Item is a row; sort by any
   column. Rendered with TanStack Table (already installed, porcelain-native
   HTML) for this seed cut. The IA reserves Glide Data Grid as the production
   engine for scale (millions of rows, canvas, in-cell editing); it is installed
   and swaps in once the repo's workspace module-resolution is sorted.

   Strangler discipline (as with /v2 Index): static seed rows so the surface can
   be judged against the porcelain north-star before wiring the real ObjectQuery.
   Replace SEED with commonplace-api items (Query.items / itemsAsOf); sorting and
   the porcelain skin carry over unchanged. */

import { useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
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

// Seed set: shape mirrors commonplace-api ItemGql. Swap for live items next.
const SEED: Row[] = [
  { id: 'itm_9f2a', kind: 'file', title: 'Ordinance 24-113, porch lighting and setbacks.pdf', tags: 'porch, setback', collection: 'Zoning', created: '2026-07-02', validFrom: '2026-06-18' },
  { id: 'itm_7c11', kind: 'link', title: 'How ADHD brains use external memory systems', tags: 'adhd, pkm', collection: 'Reading', created: '2026-07-02', validFrom: '—' },
  { id: 'itm_5b83', kind: 'note', title: 'Voice note, 47 seconds (transcribed)', tags: 'transcribed', collection: 'PorchFest 2026', created: '2026-07-01', validFrom: '—' },
  { id: 'itm_44de', kind: 'task', title: 'Send GCLBA compliance report, week 27', tags: 'compliance, gclba', collection: 'PorchFest 2026', created: '2026-07-01', validFrom: '2026-07-06' },
  { id: 'itm_2a90', kind: 'claim', title: 'Required setback distance is 15 feet on corner lots', tags: 'zoning, contested', collection: 'Zoning', created: '2026-06-30', validFrom: '2026-06-18' },
  { id: 'itm_1f57', kind: 'note', title: 'Pairformer scatter-add kernel notes', tags: 'theseus, kernel', collection: 'Engine', created: '2026-06-29', validFrom: '—' },
  { id: 'itm_0c3b', kind: 'source', title: '2019 zoning map, Genesee County', tags: 'zoning, map', collection: 'Zoning', created: '2026-06-28', validFrom: '2019-01-01' },
  { id: 'itm_e81d', kind: 'link', title: 'Elicit corpus-table extraction pattern', tags: 'research, ux', collection: 'Reading', created: '2026-06-27', validFrom: '—' },
];

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
  // Fold in any refile corrections already made this session (a surface opened
  // after the correction), then keep listening for live ones below.
  const [data, setData] = useState<Row[]>(() =>
    SEED.map((row) => {
      const label = refiledLabel(row.id, row.title);
      return label ? { ...row, collection: label } : row;
    }),
  );

  // A refile correction from any surface (e.g. the Index) moves the item's
  // Collection cell here immediately. Match by id (live) or title (fixture).
  useRefileSignal((signal) => {
    setData((rows) =>
      rows.map((row) =>
        row.id === signal.id || row.title === signal.title
          ? { ...row, collection: signal.label }
          : row,
      ),
    );
  });

  const table = useReactTable({
    data,
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
          <div className="p-kicker">Data / Ledger</div>
          <h1 className="p-h1">Ledger</h1>
        </div>
        <div className="p-cmd">
          <span>Search or command</span>
          <span className="p-kbd">&#8984;K</span>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={styles.frame}>
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
        </div>
      </div>
    </>
  );
}
