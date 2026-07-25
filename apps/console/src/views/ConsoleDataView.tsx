'use client';

// SOURCING: @commonplace/console-block for the WASM contract and door,
// jacksonkasi1/tnks-data-table over TanStack for all data grids, and
// @cosmos.gl/graph for graph paint and interaction. The tab grammar follows
// the registered Int UI editor tabs already used by the shell.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import {
  SameOriginGraphqlDoor,
  type ConsoleDoor,
} from '@commonplace/console-block/door';
import {
  CONSOLE_LAYOUT_FINGERPRINT,
  CONSOLE_LAYOUT_SEED,
} from '@commonplace/console-block/fixture-layout';
import { CORPUS_READ_GRANT } from '@commonplace/console-block/plugin';
import { canMountConsole } from '@commonplace/console-block/plugin';
import { loadConsoleWasm } from '@commonplace/console-block/wasm-fixture';
import type {
  ConsoleSnapshot,
  EntityDetail,
  Receipt,
  ReceiptKind,
  StandingFiring,
} from '@commonplace/console-block/types';
import { TnksDataTable } from '@/components/sources/tnks-data-table';
import { CosmosGraphSurface } from '@/lib/console-plugin/CosmosGraphSurface';
import { useConsolePlugin } from '@/lib/console-plugin/plugin-store';
import { useShellStore } from '@/lib/shell-store';
import { ViewState } from './ViewStates';

type SurfaceId = 'overview' | 'entities' | 'receipts' | 'watch' | 'graph';

const SURFACES: readonly { readonly id: SurfaceId; readonly label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'entities', label: 'Entities' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'watch', label: 'Watch' },
  { id: 'graph', label: 'Graph' },
];

const RECEIPT_KINDS: readonly { readonly value: ReceiptKind | 'all'; readonly label: string }[] = [
  { value: 'all', label: 'All kinds' },
  { value: 'ingest', label: 'Ingest' },
  { value: 'merge', label: 'Merge' },
  { value: 'query_firing', label: 'Query firing' },
  { value: 'consent', label: 'Consent' },
];

const RECEIPT_PAGE_SIZE = 2;
const WATCH_RING_LIMIT = 50;
const CONTROL_CLASS =
  'h-ij-control rounded-ij-arc-underline border border-ij-control-border bg-ij-chrome px-3 text-ij-ink-info hover:bg-ij-hover-surface focus:outline-2 focus:outline-ij-accent disabled:text-ij-ink-disabled';
const SELECTED_CONTROL_CLASS = `${CONTROL_CLASS} bg-ij-selection text-ij-ink`;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatTime(value: number): string {
  return dateFormatter.format(new Date(value));
}

function confidence(value: number): string {
  return `${(value / 10_000).toFixed(1)}%`;
}

function ConsoleTable<TData>({
  data,
  columns,
  getRowId,
  selectedRowId,
  onRowClick,
  className,
}: {
  readonly data: readonly TData[];
  readonly columns: readonly ColumnDef<TData, unknown>[];
  readonly getRowId: (row: TData) => string;
  readonly selectedRowId?: string | null;
  readonly onRowClick?: (rowId: string) => void;
  readonly className?: string;
}) {
  const tableData = useMemo(() => [...data], [data]);
  const tableColumns = useMemo(() => [...columns], [columns]);
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <TnksDataTable
      table={table}
      className={className}
      selectedRowId={selectedRowId}
      onRowClick={onRowClick}
    />
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="grid min-w-36 flex-1 gap-1 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-3">
      <span className="text-ij-ink-info">{label}</span>
      <strong className="text-xl text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
        {value}
      </strong>
    </div>
  );
}

function OverviewSurface({ snapshot }: { readonly snapshot: ConsoleSnapshot }) {
  const counts = snapshot.overview.counts_by_type.map(([nodeType, count]) => ({ nodeType, count }));
  const columns = useMemo<ColumnDef<{ nodeType: string; count: number }>[]>(
    () => [
      { accessorKey: 'nodeType', header: 'Node type', size: 240 },
      { accessorKey: 'count', header: 'Count', size: 120 },
    ],
    [],
  );
  const total = counts.reduce((sum, item) => sum + item.count, 0);

  return (
    <div data-console-surface="overview" className="grid h-full min-h-0 gap-3 overflow-y-auto">
      <div className="flex flex-wrap gap-3">
        <Metric label="Generation" value={snapshot.overview.generation.toLocaleString()} />
        <Metric label="Known nodes" value={total.toLocaleString()} />
        <Metric label="Receipts" value={snapshot.receipts.length.toLocaleString()} />
        <Metric label="Standing queries" value={snapshot.standing_queries.length.toLocaleString()} />
      </div>
      <section className="grid min-h-56 gap-2" aria-labelledby="console-counts-heading">
        <h2 id="console-counts-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Counts by node type
        </h2>
        <ConsoleTable
          data={counts}
          columns={columns}
          getRowId={(row) => row.nodeType}
          className="min-h-48"
        />
      </section>
      <section className="grid gap-2" aria-labelledby="console-readiness-heading">
        <h2 id="console-readiness-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Index readiness
        </h2>
        <ul className="grid gap-1 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-2">
          {snapshot.overview.readiness.map((item) => (
            <li key={item.capability} className="flex min-h-ij-row items-center justify-between gap-3">
              <span>{item.capability}</span>
              <span className="text-right text-ij-ink-info">
                {item.state}: {item.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EntityDetailPanel({ detail }: { readonly detail: EntityDetail }) {
  return (
    <aside className="min-h-0 overflow-y-auto rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-3">
      <header className="mb-3 grid gap-1">
        <h2 className="text-lg" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          {detail.record.title}
        </h2>
        <p className="font-ij-mono text-ij-ink-info">{detail.record.id}</p>
      </header>
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1">
        {Object.entries(detail.record.fields).map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-ij-ink-info">{name}</dt>
            <dd className="min-w-0 truncate">{JSON.stringify(value)}</dd>
          </div>
        ))}
      </dl>
      <section className="mb-4 grid gap-2">
        <h3 style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Merge receipts ({detail.merges.length})
        </h3>
        {detail.merges.length === 0 ? (
          <p className="text-ij-ink-info">No merge receipts.</p>
        ) : (
          <ul className="grid gap-2">
            {detail.merges.map((merge) => (
              <li key={merge.id} className="rounded-ij-arc bg-ij-editor p-2">
                <div>{merge.merged_ids.join(', ')}</div>
                <div className="text-ij-ink-info">
                  {confidence(merge.confidence_ppm)} confidence from {merge.basis.join(', ')}
                </div>
                <div className="font-ij-mono text-ij-ink-info">{merge.id}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mb-4 grid gap-2">
        <h3 style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Doppelganger candidates ({detail.candidates.length})
        </h3>
        {detail.candidates.length === 0 ? (
          <p className="text-ij-ink-info">No unresolved candidates.</p>
        ) : (
          <ul className="grid gap-2">
            {detail.candidates.map((candidate) => (
              <li key={candidate.candidate_id} className="rounded-ij-arc bg-ij-editor p-2">
                <div className="font-ij-mono">{candidate.candidate_id}</div>
                <div className="text-ij-ink-info">
                  {confidence(candidate.confidence_ppm)} from {candidate.shared_signals.join(', ')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-2">
        <h3 style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Related receipts ({detail.receipts.length})
        </h3>
        <ul className="grid gap-1">
          {detail.receipts.map((receipt) => (
            <li key={receipt.id} className="rounded-ij-arc bg-ij-editor p-2">
              {receipt.summary}
              <div className="font-ij-mono text-ij-ink-info">{receipt.id}</div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function EntitiesSurface({ snapshot }: { readonly snapshot: ConsoleSnapshot }) {
  const [selectedId, setSelectedId] = useState(snapshot.entities[0]?.record.id ?? null);
  const columns = useMemo<ColumnDef<EntityDetail>[]>(
    () => [
      { id: 'title', accessorFn: (detail) => detail.record.title, header: 'Entity', size: 220 },
      { id: 'type', accessorFn: (detail) => detail.record.entity_type, header: 'Type', size: 100 },
      { id: 'id', accessorFn: (detail) => detail.record.id, header: 'Golden ID', size: 260 },
      { id: 'merges', accessorFn: (detail) => detail.merges.length, header: 'Merges', size: 90 },
      { id: 'candidates', accessorFn: (detail) => detail.candidates.length, header: 'Candidates', size: 110 },
    ],
    [],
  );
  const selected = snapshot.entities.find((detail) => detail.record.id === selectedId) ?? snapshot.entities[0];

  return (
    <div data-console-surface="entities" className="grid h-full min-h-0 gap-3 lg:grid-cols-2">
      <section className="flex min-h-0 flex-col gap-2" aria-labelledby="console-entities-heading">
        <div>
          <h2 id="console-entities-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            Golden records
          </h2>
          <p className="text-ij-ink-info">Select a record to inspect merges and candidates.</p>
        </div>
        <ConsoleTable
          data={snapshot.entities}
          columns={columns}
          getRowId={(detail) => detail.record.id}
          selectedRowId={selected?.record.id}
          onRowClick={setSelectedId}
          className="min-h-0 flex-1"
        />
      </section>
      {selected ? <EntityDetailPanel detail={selected} /> : null}
    </div>
  );
}

function ReceiptsSurface({ snapshot }: { readonly snapshot: ConsoleSnapshot }) {
  const [kind, setKind] = useState<ReceiptKind | 'all'>('all');
  const [page, setPage] = useState(0);
  const matching = snapshot.receipts.filter((receipt) => kind === 'all' || receipt.kind === kind);
  const pageCount = Math.max(1, Math.ceil(matching.length / RECEIPT_PAGE_SIZE));
  const rows = matching.slice(page * RECEIPT_PAGE_SIZE, (page + 1) * RECEIPT_PAGE_SIZE);
  const columns = useMemo<ColumnDef<Receipt>[]>(
    () => [
      { accessorKey: 'kind', header: 'Kind', size: 120 },
      { accessorKey: 'summary', header: 'Summary', size: 320 },
      { accessorKey: 'subject_id', header: 'Subject', size: 240 },
      { accessorKey: 'actor', header: 'Actor', size: 160 },
      {
        accessorKey: 'occurred_at_ms',
        header: 'Occurred',
        size: 190,
        cell: (context) => formatTime(context.row.original.occurred_at_ms),
      },
    ],
    [],
  );

  return (
    <div data-console-surface="receipts" className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Immutable receipts</h2>
          <p className="text-ij-ink-info">Typed evidence returned through the caller door.</p>
        </div>
        <label className="grid gap-1 text-ij-ink-info">
          Kind
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.currentTarget.value as ReceiptKind | 'all');
              setPage(0);
            }}
            className={CONTROL_CLASS}
          >
            {RECEIPT_KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <ConsoleTable
        data={rows}
        columns={columns}
        getRowId={(receipt) => receipt.id}
        className="min-h-0 flex-1"
      />
      <footer className="flex items-center justify-between gap-3">
        <span className="text-ij-ink-info">
          Page {page + 1} of {pageCount}. {matching.length} receipts.
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className={CONTROL_CLASS}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            className={CONTROL_CLASS}
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}

function WatchSurface({ snapshot, door }: { readonly snapshot: ConsoleSnapshot; readonly door: ConsoleDoor }) {
  const initialQueryId = snapshot.standing_queries[0]?.id ?? '';
  const [queryId, setQueryId] = useState(initialQueryId);
  const [events, setEvents] = useState<StandingFiring[]>(() =>
    snapshot.firings.filter((event) => event.query_id === initialQueryId),
  );
  const [paused, setPaused] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void door
      .subscribe({ query_id: queryId }, (event) => {
        if (!active || pausedRef.current) return;
        setEvents((current) => [...current, event].slice(-WATCH_RING_LIMIT));
      })
      .then((next) => {
        if (active) unsubscribe = next;
        else next();
      })
      .catch((cause: unknown) => {
        if (active) {
          setSubscriptionError(
            cause instanceof Error ? cause.message : 'Standing-query subscription unavailable',
          );
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [door, queryId, snapshot.firings]);

  const first = events[0]?.occurred_at_ms;
  const last = events.at(-1)?.occurred_at_ms;
  const eventsPerSecond =
    first !== undefined && last !== undefined && last > first
      ? (events.length - 1) / ((last - first) / 1000)
      : 0;
  const selectedQuery = snapshot.standing_queries.find((query) => query.id === queryId);

  return (
    <div data-console-surface="watch" className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Standing watch</h2>
          <p className="text-ij-ink-info">Caller-selected subscription with a bounded event ring.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-ij-arc bg-ij-ok-bg px-2 py-1 text-ij-ok">
            {paused ? 'paused' : 'live'}
          </span>
          <span className="text-ij-ink-info">{eventsPerSecond.toFixed(2)} events/s</span>
          <button type="button" className={CONTROL_CLASS} onClick={() => setPaused((value) => !value)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>
      {subscriptionError ? (
        <p role="status" className="rounded-ij-arc bg-ij-gold-tint p-2 text-ij-gold">
          {subscriptionError}. Showing the latest receipted events returned by the door.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2" role="list" aria-label="Standing query shapes">
        {snapshot.standing_queries.map((query) => (
          <button
            key={query.id}
            type="button"
            onClick={() => {
              setEvents(snapshot.firings.filter((event) => event.query_id === query.id));
              setSubscriptionError(null);
              setQueryId(query.id);
            }}
            aria-pressed={query.id === queryId}
            className={query.id === queryId ? SELECTED_CONTROL_CLASS : CONTROL_CLASS}
          >
            {query.name}
          </button>
        ))}
        {selectedQuery ? <span className="self-center text-ij-ink-info">{selectedQuery.shape}</span> : null}
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto rounded-ij-arc border border-ij-seam-raised bg-ij-chrome">
        {[...events].reverse().map((event) => (
          <li key={`${event.query_id}:${event.sequence}`} className="grid min-h-ij-row gap-1 border-b border-ij-seam p-2">
            <span>
              #{event.sequence} {event.matched_ids.join(', ')}
            </span>
            <span className="font-ij-mono text-ij-ink-info">{event.receipt_id}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GraphSurface({ snapshot }: { readonly snapshot: ConsoleSnapshot }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectNode = useCallback((nodeId: string | null) => setSelectedNodeId(nodeId), []);
  const selectedNode = snapshot.graph.nodes.find((node) => node.id === selectedNodeId);
  const selectedEntity = selectedNode?.golden_id
    ? snapshot.entities.find((detail) => detail.record.id === selectedNode.golden_id)
    : undefined;

  return (
    <div data-console-surface="graph" className="grid h-full min-h-0 gap-3 lg:grid-cols-4">
      <div className="min-h-0 lg:col-span-3">
        <CosmosGraphSurface
          graph={snapshot.graph}
          selectedNodeId={selectedNodeId}
          onSelectNode={selectNode}
        />
      </div>
      <aside className="min-h-0 overflow-y-auto rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-3">
        <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Neighborhood nodes</h2>
        <p className="mb-3 text-ij-ink-info">
          Fixed B2 positions. Fingerprint {CONSOLE_LAYOUT_FINGERPRINT.toString()}.
        </p>
        <ul className="grid gap-1">
          {snapshot.graph.nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                aria-pressed={node.id === selectedNodeId}
                className="w-full rounded-ij-arc p-2 text-left hover:bg-ij-hover-surface aria-pressed:bg-ij-selection"
              >
                <span className="block">{node.label}</span>
                <span className="font-ij-mono text-ij-ink-info">{node.id}</span>
              </button>
            </li>
          ))}
        </ul>
        <section className="mt-4 border-t border-ij-seam pt-3">
          <h3 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Selected entity</h3>
          {selectedEntity ? (
            <div>
              <p>{selectedEntity.record.title}</p>
              <p className="font-ij-mono text-ij-ink-info">{selectedEntity.record.id}</p>
            </div>
          ) : (
            <p className="text-ij-ink-info">Select a golden node.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

function surfaceContent(
  surface: SurfaceId,
  snapshot: ConsoleSnapshot,
  door: ConsoleDoor,
): ReactNode {
  switch (surface) {
    case 'overview':
      return <OverviewSurface snapshot={snapshot} />;
    case 'entities':
      return <EntitiesSurface snapshot={snapshot} />;
    case 'receipts':
      return <ReceiptsSurface snapshot={snapshot} />;
    case 'watch':
      return <WatchSurface snapshot={snapshot} door={door} />;
    case 'graph':
      return <GraphSurface snapshot={snapshot} />;
  }
}

function InstalledConsoleDataView() {
  const [surface, setSurface] = useState<SurfaceId>('overview');
  const [door] = useState(() => new SameOriginGraphqlDoor([CORPUS_READ_GRANT]));
  const [snapshot, setSnapshot] = useState<ConsoleSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([door.snapshot(), loadConsoleWasm()])
      .then(([next, runtime]) => {
        if (runtime.settledLayoutFingerprint(CONSOLE_LAYOUT_SEED, 10_000) !== CONSOLE_LAYOUT_FINGERPRINT) {
          throw new Error('Console WASM layout contract does not match the registered web positions');
        }
        if (active) setSnapshot(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Console door failed');
      });
    return () => {
      active = false;
    };
  }, [door]);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % SURFACES.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + SURFACES.length) % SURFACES.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SURFACES.length - 1;
    else return;
    event.preventDefault();
    setSurface(SURFACES[next]!.id);
    document.getElementById(`console-tab-${SURFACES[next]!.id}`)?.focus();
  };

  return (
    <div data-console-data-view className="flex h-full min-h-0 flex-col bg-ij-editor text-ij-ink">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ij-seam bg-ij-chrome px-3 py-2">
        <div>
          <h1 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Your data console</h1>
          <p className="text-ij-ink-info">Records, evidence, watches, and graph through one read-only door.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-ij-ink-info">
          <span className="rounded-ij-arc bg-ij-row-gray px-2 py-1">authenticated door</span>
          <span className="rounded-ij-arc bg-ij-row-gray px-2 py-1">WASM core</span>
          <span className="rounded-ij-arc bg-ij-ok-bg px-2 py-1 text-ij-ok">read only</span>
          <span className="rounded-ij-arc bg-ij-selection px-2 py-1">corpus:read</span>
        </div>
      </header>
      <div role="tablist" aria-label="Console surfaces" className="flex overflow-x-auto border-b border-ij-seam bg-ij-chrome px-1">
        {SURFACES.map((item, index) => {
          const selected = item.id === surface;
          return (
            <button
              key={item.id}
              id={`console-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`console-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setSurface(item.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className="h-ij-tab border-b-2 border-transparent px-4 text-ij-ink-info aria-selected:border-ij-accent aria-selected:bg-ij-selection aria-selected:text-ij-ink focus:outline-2 focus:outline-ij-accent"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <main
        id={`console-panel-${surface}`}
        role="tabpanel"
        aria-labelledby={`console-tab-${surface}`}
        className="min-h-0 flex-1 p-3"
      >
        {error ? (
          <ViewState state="error" errorMessage={error} />
        ) : snapshot ? (
          surfaceContent(surface, snapshot, door)
        ) : (
          <ViewState state="loading" skeleton="rows" />
        )}
      </main>
    </div>
  );
}

export function ConsoleDataView(_props: ViewRenderProps) {
  const tenant = useShellStore((state) => state.tenant);
  const status = useConsolePlugin(tenant);
  if (!canMountConsole(status)) {
    return (
      <div data-console-plugin-unmounted data-console-plugin-state={status.state} className="h-full">
        <ViewState capability="Your data access from Index or Appearance settings" state="unavailable" />
      </div>
    );
  }
  return <InstalledConsoleDataView />;
}
