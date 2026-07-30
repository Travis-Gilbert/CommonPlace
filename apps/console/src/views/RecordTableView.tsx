'use client';

// SOURCING: jacksonkasi1/tnks-data-table structure on @tanstack/react-table +
// @tanstack/react-virtual (shared shell at components/sources/tnks-data-table).
// The record.table descriptor (G6 / B9): fed by the block contract; sort and
// filter bind to ObjectQuery against the host (the data API seam), never to
// local demo state. Density is the --rec-* group: rows on the 4px grid, cell
// padding and utility column from register tokens, clickable row transition.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { BlockHost, ObjectQuery, ObjectRef, ObjectSet, Predicate } from '@commonplace/block-view/types';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { useShellStore } from '@/lib/shell-store';
import { ViewState, type ViewStateKind } from './ViewStates';
import { CalculateFooter, type AggregateCellValue } from './records/CalculateFooter';
import { renderFieldCell } from './records/cells';
import {
  enterHardFocus,
  exitFocus,
  moveSoftFocus,
  type CellFocus,
} from './records/focus';
import { RecordChip } from './records/RecordChip';
import {
  columnsFromObjectType,
  extractRecordSchemaContext,
  type AggregateOp,
  type SchemaColumnDef,
  visibilityForWidth as schemaVisibilityForWidth,
} from './records/schemaColumns';
import { STATUS_HUES, TAG_HUES } from './records/tints';
import { ViewBar } from './records/ViewBar';

interface RecordRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  updated: string;
  tags: readonly string[];
}

interface SchemaRow {
  id: string;
  properties: Record<string, unknown>;
}

function toLegacyRow(object: ObjectRef): RecordRow {
  return {
    id: object.id,
    title: String(object.properties.title ?? ''),
    kind: String(object.properties.kind ?? ''),
    status: String(object.properties.status ?? ''),
    updated: String(object.properties.updated ?? ''),
    tags: Array.isArray(object.properties.tags) ? (object.properties.tags as string[]) : [],
  };
}

function toSchemaRow(object: ObjectRef): SchemaRow {
  return {
    id: object.id,
    properties: { ...object.properties } as Record<string, unknown>,
  };
}

const legacyColumnHelper = createColumnHelper<RecordRow>();
const schemaColumnHelper = createColumnHelper<SchemaRow>();

const LEGACY_COLUMN_CLASS: Record<string, string> = {
  utility: 'shrink-0 w-rec-utility-col',
  title: 'min-w-0 flex-1',
  kind: 'shrink-0 w-24',
  status: 'shrink-0 w-28',
  updated: 'shrink-0 w-24',
  tags: 'shrink-0 w-44',
};

const LEGACY_COL_W = { utility: 32, status: 112, kind: 96, updated: 96, tags: 176 } as const;
const LEGACY_TITLE_MIN = 160;

function legacyVisibilityFor(width: number): VisibilityState {
  const fits = (...cols: (keyof typeof LEGACY_COL_W)[]) =>
    width >= LEGACY_TITLE_MIN + cols.reduce((sum, col) => sum + LEGACY_COL_W[col], 0);
  const status = fits('status');
  const utility = status && fits('status', 'utility');
  const kind = utility && fits('status', 'utility', 'kind');
  const updated = kind && fits('status', 'utility', 'kind', 'updated');
  const tags = updated && fits('status', 'utility', 'kind', 'updated', 'tags');
  return { utility, status, kind, updated, tags };
}

type HostWithInvoke = BlockHost & {
  invoke?: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
};

function unavailableAggregates(columns: readonly SchemaColumnDef[]): Record<string, AggregateCellValue> {
  return Object.fromEntries(
    columns.map((column) => [
      column.fieldKey,
      { status: 'unavailable', reason: 'Aggregate host unavailable' } satisfies AggregateCellValue,
    ]),
  );
}

export function RecordTableView({ set: initialSet, host, instance }: ViewRenderProps) {
  const selectRecord = useShellStore((state) => state.selectRecord);
  const selectedRecordId = useShellStore((state) => state.selectedRecordId);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [result, setResult] = useState<ObjectSet>(initialSet);
  const [stateKind, setStateKind] = useState<ViewStateKind>('populated');
  const [activeViewId, setActiveViewId] = useState<string | undefined>(undefined);
  const [cellFocus, setCellFocus] = useState<CellFocus | null>(null);
  const [aggregateOps, setAggregateOps] = useState<Record<string, AggregateOp>>({});
  const [aggregateValues, setAggregateValues] = useState<Record<string, AggregateCellValue>>({});

  const schemaContext = useMemo(
    () => extractRecordSchemaContext(result, instance),
    [instance, result],
  );

  const activeView = useMemo(
    () => schemaContext?.views.find((view) => view.id === activeViewId)
      ?? schemaContext?.views[0],
    [activeViewId, schemaContext?.views],
  );

  const schemaColumns = useMemo(() => {
    if (!schemaContext?.objectType) return [] as SchemaColumnDef[];
    return columnsFromObjectType(
      schemaContext.objectType,
      schemaContext.fields,
      activeView,
      result.shape.fields,
    );
  }, [activeView, result.shape.fields, schemaContext]);

  useEffect(() => {
    if (schemaContext?.activeViewId) setActiveViewId(schemaContext.activeViewId);
  }, [schemaContext?.activeViewId]);

  useEffect(() => {
    let active = true;
    setStateKind('loading');
    const predicates: Predicate[] = [];
    if (filterText) predicates.push({ kind: 'contains', field: 'title', value: filterText });
    if (statusFilter) predicates.push({ kind: 'eq', field: 'status', value: statusFilter });
    const query: ObjectQuery = {
      types: schemaContext?.objectTypeKey ? [schemaContext.objectTypeKey] : ['record'],
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
  }, [host, schemaContext?.objectTypeKey, sorting, filterText, statusFilter]);

  const legacyRows = useMemo(() => result.objects.map(toLegacyRow), [result]);
  const schemaRows = useMemo(() => result.objects.map(toSchemaRow), [result]);

  const legacyColumns = useMemo(
    () => [
      legacyColumnHelper.display({
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
      legacyColumnHelper.accessor('title', { header: 'Title' }),
      legacyColumnHelper.accessor('kind', {
        header: 'Kind',
        cell: (info) => (
          <RecordChip label={info.getValue()} tint={TAG_HUES[info.getValue()]?.tint} ink={TAG_HUES[info.getValue()]?.ink} />
        ),
      }),
      legacyColumnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => {
          const hue = STATUS_HUES[info.getValue()];
          return <RecordChip label={info.getValue()} tint={hue.tint} ink={hue.ink} />;
        },
      }),
      legacyColumnHelper.accessor('updated', {
        header: 'Updated',
        cell: (info) => <span className="font-ij-mono text-ij-ink-info">{info.getValue()}</span>,
      }),
      legacyColumnHelper.accessor('tags', {
        header: 'Tags',
        enableSorting: false,
        cell: (info) => (
          <span className="flex gap-rec-sibling-gap">
            {info.getValue().map((tag) => {
              const hue = TAG_HUES[tag];
              return (
                <RecordChip key={tag} label={tag} tint={hue?.tint} ink={hue?.ink} />
              );
            })}
          </span>
        ),
      }),
    ],
    [selectRecord, selectedRecordId],
  );

  const schemaColumnsDef = useMemo(
    () => [
      schemaColumnHelper.display({
        id: 'utility',
        size: 32,
        header: () => null,
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.id}`}
            checked={selectedRecordId === row.original.id}
            onChange={() => selectRecord(selectedRecordId === row.original.id ? null : row.original.id)}
            className="accent-ij-accent"
          />
        ),
      }),
      ...schemaColumns.map((column) =>
        schemaColumnHelper.accessor(
          (row) => row.properties[column.fieldKey],
          {
            id: column.fieldKey,
            header: column.label,
            cell: (info) => renderFieldCell(column.fieldType, info.getValue(), { label: column.label }),
          },
        ),
      ),
    ],
    [schemaColumns, selectRecord, selectedRecordId],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    schemaContext ? schemaVisibilityForWidth(320, schemaColumns) : legacyVisibilityFor(320),
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width <= 0) return;
      setColumnVisibility(
        schemaContext
          ? schemaVisibilityForWidth(width, schemaColumns, schemaContext.objectType?.labelIdentifierField)
          : legacyVisibilityFor(width),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [schemaColumns, schemaContext]);

  const legacyTable = useReactTable({
    data: legacyRows,
    columns: legacyColumns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const schemaTable = useReactTable({
    data: schemaRows,
    columns: schemaColumnsDef,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const table = schemaContext ? schemaTable : legacyTable;
  const columnClass = useCallback(
    (columnId: string) => {
      if (!schemaContext) return LEGACY_COLUMN_CLASS[columnId] ?? '';
      if (columnId === 'utility') return 'shrink-0 w-rec-utility-col';
      const column = schemaColumns.find((entry) => entry.fieldKey === columnId);
      return column?.widthClass ?? 'shrink-0 w-28';
    },
    [schemaColumns, schemaContext],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowModel = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rowModel.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 12,
  });

  const fieldKeys = useMemo(
    () => (schemaContext ? schemaColumns.map((column) => column.fieldKey) : []),
    [schemaColumns, schemaContext],
  );
  const rowIds = useMemo(
    () => (schemaContext ? schemaRows.map((row) => row.id) : legacyRows.map((row) => row.id)),
    [legacyRows, schemaContext, schemaRows],
  );

  const onTableKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!schemaContext) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowUp'
          ? 'up'
          : event.key === 'ArrowDown'
            ? 'down'
            : event.key === 'ArrowLeft'
              ? 'left'
              : 'right';
        setCellFocus((current) => moveSoftFocus(current, direction, rowIds, fieldKeys));
        return;
      }
      if (event.key === 'Enter' && cellFocus?.mode === 'soft') {
        event.preventDefault();
        setCellFocus(enterHardFocus(cellFocus));
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setCellFocus((current) => exitFocus(current));
      }
    },
    [cellFocus, fieldKeys, rowIds, schemaContext],
  );

  useEffect(() => {
    if (!schemaContext || schemaColumns.length === 0) {
      setAggregateValues({});
      return;
    }
    const invoke = (host as HostWithInvoke).invoke;
    if (!invoke) {
      setAggregateValues(unavailableAggregates(schemaColumns));
      return;
    }
    let active = true;
    setAggregateValues(
      Object.fromEntries(
        schemaColumns.map((column) => [column.fieldKey, { status: 'loading' } satisfies AggregateCellValue]),
      ),
    );
    Promise.resolve(
      invoke('records.aggregate', {
        objectTypeKey: schemaContext.objectTypeKey ?? schemaContext.objectType?.key,
        columns: schemaColumns.map((column) => ({
          fieldKey: column.fieldKey,
          op: aggregateOps[column.fieldKey] ?? 'count',
        })),
        recordIds: schemaRows.map((row) => row.id),
      }),
    )
      .then((payload) => {
        if (!active) return;
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
          setAggregateValues(unavailableAggregates(schemaColumns));
          return;
        }
        const record = payload as Record<string, AggregateCellValue>;
        setAggregateValues(record);
      })
      .catch(() => {
        if (active) setAggregateValues(unavailableAggregates(schemaColumns));
      });
    return () => {
      active = false;
    };
  }, [aggregateOps, host, schemaColumns, schemaContext, schemaRows]);

  const onSelectAggregateOp = useCallback((fieldKey: string, op: AggregateOp) => {
    setAggregateOps((current) => ({ ...current, [fieldKey]: op }));
  }, []);

  if (stateKind === 'error') {
    return (
      <ViewState
        state="error"
        mode="shell"
        errorMessage="Record query failed."
        onRetry={() => setSorting([...sorting])}
      />
    );
  }

  const rowCount = schemaContext ? schemaRows.length : legacyRows.length;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="flex h-full flex-col outline-none focus-visible:outline-2 focus-visible:outline-ij-accent"
      data-records-state={stateKind}
      onKeyDown={onTableKeyDown}
    >
      {schemaContext && schemaContext.views.length > 0 ? (
        <ViewBar
          views={schemaContext.views}
          activeViewId={activeView?.id}
          count={rowCount}
          onSelectView={setActiveViewId}
          onSaveAs={() => undefined}
        />
      ) : null}
      <div className="flex h-ij-toolbar shrink-0 items-center gap-2 px-2">
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter records"
          aria-label="Filter records by title"
          className="h-ij-control min-w-0 flex-1 px-rec-cell-pad text-ij-ink placeholder:text-ij-ink-disabled focus:outline-2 focus:outline-ij-accent"
        />
        {!schemaContext ? (
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter records by status"
            className="h-ij-control shrink-0 px-2 text-ij-ink"
          >
            <option value="">All</option>
            <option value="open">open</option>
            <option value="processing">processing</option>
            <option value="settled">settled</option>
          </select>
        ) : null}
        {schemaContext && schemaContext.views.length === 0 ? (
          <span className="shrink-0 whitespace-nowrap font-ij-mono text-ij-ink-info">{rowCount}</span>
        ) : null}
      </div>
      {stateKind === 'empty' ? (
        <ViewState state="empty" mode="shell" />
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse" style={{ fontWeight: 'var(--rec-weight-regular)' }}>
              <thead className="sticky top-0 z-10 bg-ij-chrome">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="flex w-full items-center">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className={`h-8 px-rec-cell-pad text-left leading-8 text-ij-ink-info ${columnClass(header.column.id)}`}
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
                  const originalId = schemaContext
                    ? (row.original as SchemaRow).id
                    : (row.original as RecordRow).id;
                  return (
                    <tr
                      key={row.id}
                      tabIndex={-1}
                      data-record-id={originalId}
                      data-selected={selectedRecordId === originalId ? 'true' : undefined}
                      onClick={() => selectRecord(originalId)}
                      className="absolute left-0 top-0 flex w-full cursor-default items-center overflow-hidden hover:bg-ij-hover-surface data-[selected]:bg-ij-selection"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                        height: 32,
                        transition: 'var(--rec-clickable-transition)',
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const focused = cellFocus
                          && cellFocus.rowId === originalId
                          && cellFocus.fieldKey === cell.column.id;
                        return (
                          <td
                            key={cell.id}
                            data-field-key={cell.column.id}
                            data-cell-focus={focused ? cellFocus.mode : undefined}
                            className={`overflow-hidden text-ellipsis whitespace-nowrap px-rec-cell-pad ${columnClass(cell.column.id)} ${
                              focused
                                ? cellFocus.mode === 'hard'
                                  ? 'ring-2 ring-inset ring-ij-accent'
                                  : 'ring-1 ring-inset ring-ij-accent'
                                : ''
                            }`}
                          >
                            {flexRender(
                              // Union of schema/legacy tables: cell renderer is always defined for visible cells.
                              cell.column.columnDef.cell as never,
                              cell.getContext() as never,
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {schemaContext && schemaColumns.length > 0 ? (
            <CalculateFooter
              columns={schemaColumns.map((column) => ({
                fieldKey: column.fieldKey,
                fieldType: column.fieldType,
              }))}
              values={aggregateValues}
              selectedOps={aggregateOps}
              onSelectOp={onSelectAggregateOp}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
