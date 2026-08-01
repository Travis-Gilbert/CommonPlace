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
import type { BlockHost, JsonValue, ObjectQuery, ObjectRef, ObjectSet, Predicate } from '@commonplace/block-view/types';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { useShellStore } from '@/lib/shell-store';
import { ViewState, type ViewStateKind } from './ViewStates';
import { invokeAggregate, updateOneToolName } from './records/aggregates';
import { CalculateFooter, type AggregateCellValue } from './records/CalculateFooter';
import { renderFieldCell } from './records/cells';
import { FieldEditor } from './records/editors';
import {
  enterHardFocus,
  exitFocus,
  moveSoftFocus,
  type CellFocus,
} from './records/focus';
import {
  actorsForView,
  focusedRecordIds,
  presencePublishToolArgs,
  VIEW_FOCUS_KIND,
  VIEW_LEAVE_KIND,
  VIEW_PRESENCE_KIND,
  type ViewPresenceActor,
} from './records/presence';
import { RecordChip } from './records/RecordChip';
import {
  aggregateFiltersFromView,
  columnsFromObjectType,
  extractRecordSchemaContext,
  predicatesFromViewFilters,
  rankersFromViewSorts,
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

type HostWithPresence = BlockHost & {
  readonly actorId?: string;
};

function unavailableAggregates(
  columns: readonly SchemaColumnDef[],
  reason = 'Aggregate host unavailable',
): Record<string, AggregateCellValue> {
  return Object.fromEntries(
    columns.map((column) => [
      column.fieldKey,
      { status: 'unavailable', reason } satisfies AggregateCellValue,
    ]),
  );
}

function combinePredicates(parts: Predicate[]): Predicate | undefined {
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return { kind: 'and', all: parts };
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
  const [editError, setEditError] = useState<string | null>(null);
  const [presenceActors, setPresenceActors] = useState<ViewPresenceActor[]>([]);
  const optimisticRef = useRef<Map<string, unknown>>(new Map());

  const schemaContext = useMemo(
    () => extractRecordSchemaContext(result, instance),
    [instance, result],
  );

  const activeView = useMemo(
    () => schemaContext?.views.find((view) => view.id === activeViewId)
      ?? schemaContext?.views[0],
    [activeViewId, schemaContext?.views],
  );

  const localActorId = (host as HostWithPresence).actorId ?? 'console.human';
  const presenceFocusByRecord = useMemo(
    () => focusedRecordIds(presenceActors, localActorId),
    [localActorId, presenceActors],
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
    if (schemaContext && activeView) {
      predicates.push(...predicatesFromViewFilters(activeView.filters));
    }
    const labelField = schemaContext?.objectType?.labelIdentifierField ?? 'title';
    if (filterText) predicates.push({ kind: 'contains', field: labelField, value: filterText });
    if (!schemaContext && statusFilter) {
      predicates.push({ kind: 'eq', field: 'status', value: statusFilter });
    }
    const viewRank = schemaContext && activeView && activeView.sorts.length > 0
      ? rankersFromViewSorts(activeView.sorts)
      : undefined;
    const query: ObjectQuery = {
      types: schemaContext?.objectTypeKey ? [schemaContext.objectTypeKey] : ['record'],
      where: combinePredicates(predicates),
      rank: sorting[0]
        ? [{ kind: 'field', field: sorting[0].id, direction: sorting[0].desc ? 'desc' : 'asc' }]
        : viewRank,
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
  }, [activeView, filterText, host, schemaContext, sorting, statusFilter]);

  const legacyRows = useMemo(() => result.objects.map(toLegacyRow), [result]);
  const schemaRows = useMemo(() => result.objects.map(toSchemaRow), [result]);

  const setSchemaRowProperty = useCallback((rowId: string, fieldKey: string, value: unknown) => {
    setResult((current) => ({
      ...current,
      objects: current.objects.map((object) => {
        if (object.id !== rowId) return object;
        return {
          ...object,
          properties: {
            ...object.properties,
            [fieldKey]: value as JsonValue,
          },
        };
      }),
    }));
  }, []);

  const commitCellEdit = useCallback(
    async (rowId: string, fieldKey: string, previous: unknown, next: unknown) => {
      const objectType = schemaContext?.objectType;
      if (!objectType) return;
      const keys = schemaColumns.map((column) => column.fieldKey);
      const tool = updateOneToolName(objectType.nameSingular);
      optimisticRef.current.set(`${rowId}:${fieldKey}`, previous);
      setSchemaRowProperty(rowId, fieldKey, next);
      setEditError(null);
      const receipt = await host.emit({
        kind: 'invoke_tool',
        tool,
        args: {
          id: rowId,
          [fieldKey]: next as JsonValue,
        },
      });
      if (!receipt.ok || receipt.value?.status === 'deferred') {
        setSchemaRowProperty(rowId, fieldKey, previous);
        setEditError(receipt.error ?? receipt.value?.note ?? 'Update refused');
        setCellFocus((current) => (current ? { ...current, mode: 'soft' } : current));
        return;
      }
      const note = receipt.value?.note ?? '';
      if (/reject|enforcement|refused/i.test(note)) {
        setSchemaRowProperty(rowId, fieldKey, previous);
        setEditError(note);
        setCellFocus((current) => (current ? { ...current, mode: 'soft' } : current));
        return;
      }
      optimisticRef.current.delete(`${rowId}:${fieldKey}`);
      setCellFocus((current) => {
        if (!current) return current;
        const fieldIndex = keys.indexOf(current.fieldKey);
        const nextField = keys[fieldIndex + 1];
        if (!nextField) return { ...current, mode: 'soft' };
        return { rowId: current.rowId, fieldKey: nextField, mode: 'soft' };
      });
    },
    [host, schemaColumns, schemaContext?.objectType, setSchemaRowProperty],
  );

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
            cell: (info) => {
              const rowId = info.row.original.id;
              const hard = cellFocus?.mode === 'hard'
                && cellFocus.rowId === rowId
                && cellFocus.fieldKey === column.fieldKey;
              if (hard) {
                return (
                  <FieldEditor
                    fieldType={column.fieldType}
                    value={info.getValue()}
                    onCancel={() => {
                      setEditError(null);
                      setCellFocus((current) => exitFocus(current));
                    }}
                    onCommit={(next) => {
                      void commitCellEdit(rowId, column.fieldKey, info.getValue(), next);
                    }}
                  />
                );
              }
              return renderFieldCell(column.fieldType, info.getValue(), { label: column.label });
            },
          },
        ),
      ),
    ],
    [cellFocus, commitCellEdit, schemaColumns, selectRecord, selectedRecordId],
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
      if (cellFocus?.mode === 'hard') return;
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
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (!cellFocus) {
          if (rowIds[0] && fieldKeys[0]) {
            setCellFocus({ rowId: rowIds[0], fieldKey: fieldKeys[0], mode: 'hard' });
          }
          return;
        }
        if (cellFocus.mode === 'soft') {
          event.preventDefault();
          setCellFocus(enterHardFocus(cellFocus));
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setEditError(null);
        setCellFocus((current) => exitFocus(current));
      }
    },
    [cellFocus, fieldKeys, rowIds, schemaContext],
  );

  useEffect(() => {
    if (!schemaContext?.objectType || schemaColumns.length === 0) {
      setAggregateValues({});
      return;
    }
    const namePlural = schemaContext.objectType.namePlural;
    const filters = activeView ? aggregateFiltersFromView(activeView.filters) : {};
    let active = true;
    setAggregateValues(
      Object.fromEntries(
        schemaColumns.map((column) => [column.fieldKey, { status: 'loading' } satisfies AggregateCellValue]),
      ),
    );
    void Promise.all(
      schemaColumns.map(async (column) => {
        const op = aggregateOps[column.fieldKey] ?? 'count';
        const result = await invokeAggregate(host.emit.bind(host), namePlural, column.fieldKey, op, filters);
        return [
          column.fieldKey,
          result.available
            ? ({ status: 'value', value: result.value } satisfies AggregateCellValue)
            : ({
              status: 'unavailable',
              reason: result.reason ?? 'Aggregate unavailable',
            } satisfies AggregateCellValue),
        ] as const;
      }),
    ).then((entries) => {
      if (!active) return;
      setAggregateValues(Object.fromEntries(entries));
    }).catch(() => {
      if (active) setAggregateValues(unavailableAggregates(schemaColumns, 'Aggregate invoke failed'));
    });
    return () => {
      active = false;
    };
  }, [activeView, aggregateOps, host, schemaColumns, schemaContext?.objectType]);

  useEffect(() => {
    if (!schemaContext?.objectType || !activeView) {
      setPresenceActors([]);
      return;
    }
    const viewId = activeView.id;
    const objectTypeId = schemaContext.objectType.id;
    let cancelled = false;
    const publish = (kind: typeof VIEW_PRESENCE_KIND | typeof VIEW_FOCUS_KIND | typeof VIEW_LEAVE_KIND, recordId?: string) => {
      void host.emit({
        kind: 'invoke_tool',
        tool: 'stream_publish',
        args: presencePublishToolArgs({
          kind,
          viewId,
          objectTypeId,
          actorId: localActorId,
          actorKind: 'human',
          recordId,
        }) as Record<string, JsonValue>,
      });
    };
    publish(VIEW_PRESENCE_KIND);
    const poll = window.setInterval(() => {
      void host.emit({
        kind: 'invoke_tool',
        tool: 'stream_read',
        args: {
          stream: `records.view.${viewId}`,
          limit: 50,
        },
      }).then((receipt) => {
        if (cancelled || !receipt.ok) return;
        const note = receipt.value?.note;
        let events: unknown[] = [];
        if (typeof note === 'string' && note.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(note) as { events?: unknown[] };
            events = Array.isArray(parsed.events) ? parsed.events : [];
          } catch {
            events = [];
          }
        }
        const extended = receipt.value as { events?: unknown[]; payload?: { events?: unknown[] } } | undefined;
        if (Array.isArray(extended?.events)) events = extended.events;
        if (Array.isArray(extended?.payload?.events)) events = extended.payload.events;
        setPresenceActors(actorsForView(events, viewId));
      });
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      publish(VIEW_LEAVE_KIND);
    };
  }, [activeView, host, localActorId, schemaContext?.objectType]);

  useEffect(() => {
    if (!schemaContext?.objectType || !activeView || !cellFocus) return;
    void host.emit({
      kind: 'invoke_tool',
      tool: 'stream_publish',
      args: presencePublishToolArgs({
        kind: VIEW_FOCUS_KIND,
        viewId: activeView.id,
        objectTypeId: schemaContext.objectType.id,
        actorId: localActorId,
        actorKind: 'human',
        recordId: cellFocus.rowId,
      }) as Record<string, JsonValue>,
    });
  }, [activeView, cellFocus?.rowId, host, localActorId, schemaContext?.objectType]);

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
          presence={presenceActors}
          onSaveAs={() => undefined}
        />
      ) : null}
      {editError ? (
        <div className="shrink-0 border-b border-ij-seam bg-ij-error-bg px-2 py-1 text-sm text-ij-error" role="alert" data-edit-error>
          {editError}
        </div>
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
                  const remoteFocuser = presenceFocusByRecord.get(originalId);
                  return (
                    <tr
                      key={row.id}
                      tabIndex={-1}
                      data-record-id={originalId}
                      data-selected={selectedRecordId === originalId ? 'true' : undefined}
                      data-remote-focus={remoteFocuser ?? undefined}
                      title={remoteFocuser ? `Focused by ${remoteFocuser}` : undefined}
                      onClick={() => selectRecord(originalId)}
                      className={`absolute left-0 top-0 flex w-full cursor-default items-center overflow-hidden hover:bg-ij-hover-surface data-[selected]:bg-ij-selection ${
                        remoteFocuser ? 'bg-ij-hover-surface/70' : ''
                      }`}
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
