"use client";

/* Grid — the table view, columns = title + the view's visible relations. Uses
   TanStack Table for the column model; every cell is the same RelationCell. */

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import styles from "../database.module.css";
import type { DbObject } from "../database/model";
import { ObjectGlyph, RelationCell } from "./cells";
import type { ViewProps } from "./types";

export function GridView({ objects, view, host, onOpen }: ViewProps) {
  const columns = useMemo<ColumnDef<DbObject>[]>(() => {
    const cols: ColumnDef<DbObject>[] = [
      {
        id: "title",
        header: "Name",
        cell: ({ row }) => (
          <span className={styles.cellTitle}>
            <ObjectGlyph object={row.original} size={16} />
            {row.original.title}
          </span>
        ),
      },
    ];
    for (const k of view.visibleRelations) {
      cols.push({ id: k, header: host.relation(k)?.name ?? k, cell: ({ row }) => <RelationCell cell={row.original.cells[k]} /> });
    }
    return cols;
  }, [view.visibleRelations, host]);

  const table = useReactTable({ data: objects as DbObject[], columns, getCoreRowModel: getCoreRowModel() });
  if (!objects.length) return <div className={styles.emptyState}>Nothing here yet.</div>;

  return (
    <div className={styles.gridWrap}>
      <table className={styles.gridTable}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className={styles.th}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className={styles.gridRow} onClick={() => onOpen(r.original.id)}>
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
  );
}
