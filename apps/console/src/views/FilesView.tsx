'use client';

// SOURCING: 21st.dev builduilabs filesystem-item behavior extraction and
// @tanstack/react-virtual. The tree is rebuilt on Int UI tokens and the APG
// tree contract. Live Harness memory is never mapped into invented folders:
// only the engine-owned pinned projection_path creates hierarchy.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import type { BlockHost, JsonValue, ObjectRef } from '@commonplace/block-view/types';
import { surfaceQuery } from '@commonplace/block-view/surface-tree';
import { degradationFor, withAction, type Degradation } from '@/lib/degradation';
import { DUR } from '@/motion/motion-tokens';
import {
  ensureMemoryProjection,
  projectionPathOf,
  useMemoryProjectionStore,
  type HarnessMemoryDelta,
  type HarnessMemoryItem,
} from '@/lib/memory-projection-store';
import { ACCOUNT_SURFACE_ID, WORKSPACE_SURFACE_ID } from '@/lib/workspace-seed';

type RowAction = () => unknown;

type RootRow = {
  readonly id: string;
  readonly kind: 'root';
  readonly sourceKind: 'project' | 'memory' | 'uploads';
  readonly label: string;
  readonly depth: number;
  readonly expanded: boolean;
  readonly expandable?: boolean;
  readonly status?: string;
  readonly statusTitle?: string;
  readonly description?: string;
  readonly degradation?: Degradation;
  readonly actionLabel?: string;
  readonly action?: RowAction;
};

type FolderRow = {
  readonly id: string;
  readonly kind: 'folder';
  readonly label: string;
  readonly depth: number;
  readonly expanded: boolean;
  readonly expandable?: boolean;
  readonly status?: string;
  readonly statusTitle?: string;
};

type MemoryRow = { readonly id: string; readonly kind: 'memory'; readonly label: string; readonly depth: number; readonly item: HarnessMemoryItem };

type StateRow = {
  readonly id: string;
  readonly kind: 'state';
  readonly label: string;
  readonly depth: number;
  readonly degradation?: Degradation;
  readonly actionLabel?: string;
  readonly action?: RowAction;
};

type TreeRow = RootRow | FolderRow | MemoryRow | StateRow;

interface FolderNode {
  readonly id: string;
  readonly label: string;
  readonly folders: Map<string, FolderNode>;
  readonly items: HarnessMemoryItem[];
}

function folderNode(id: string, label: string): FolderNode {
  return { id, label, folders: new Map(), items: [] };
}

function buildMemoryRows(items: readonly HarnessMemoryItem[], expanded: ReadonlySet<string>): TreeRow[] {
  const root = folderNode('root-memory', 'Harness Memory');
  const unavailable = items.filter((item) => !projectionPathOf(item));
  for (const item of items) {
    const path = projectionPathOf(item);
    if (!path) continue;
    const segments = path.split('/').map((segment) => segment.trim()).filter(Boolean);
    if (segments[0]?.toLowerCase() === 'harness memory') segments.shift();
    const directories = segments.length > 1 ? segments.slice(0, -1) : [];
    let parent = root;
    for (const segment of directories) {
      const id = `${parent.id}/${segment}`;
      let child = parent.folders.get(segment);
      if (!child) {
        child = folderNode(id, segment);
        parent.folders.set(segment, child);
      }
      parent = child;
    }
    parent.items.push(item);
  }
  const rows: TreeRow[] = [{
    id: root.id,
    kind: 'root',
    sourceKind: 'memory',
    label: root.label,
    depth: 1,
    expanded: expanded.has(root.id),
    expandable: items.length > 0,
    status: items.length > 0 ? String(items.length) : 'Empty',
  }];
  if (!expanded.has(root.id)) return rows;
  if (unavailable.length > 0) {
    rows.push({
      id: 'memory-projection-path-unavailable',
      kind: 'state',
      depth: 2,
      label: `${unavailable.length} memories unavailable: pinned projection_path is missing from the engine projection.`,
    });
  }
  const visit = (node: FolderNode, depth: number) => {
    for (const child of [...node.folders.values()].sort((a, b) => a.label.localeCompare(b.label))) {
      const open = expanded.has(child.id);
      rows.push({ id: child.id, kind: 'folder', label: child.label, depth, expanded: open });
      if (open) visit(child, depth + 1);
    }
    for (const item of [...node.items].sort((a, b) => a.title.localeCompare(b.title))) {
      rows.push({ id: `memory:${item.id}`, kind: 'memory', label: item.title, depth, item });
    }
  };
  visit(root, 2);
  return rows;
}

export async function openMemoryTab(host: BlockHost, item: HarnessMemoryItem): Promise<void> {
  const set = await Promise.resolve(host.query(surfaceQuery()));
  const byId = new Map(set.objects.map((object) => [object.id, object]));
  const surface = set.objects.find((object) => object.type === 'surface' && object.properties.active === true);
  const editor = (surface?.relations?.CONTAINS ?? [])
    .map((id) => byId.get(id))
    .find((object): object is ObjectRef => object?.type === 'region' && object.properties.kind === 'editor');
  if (!editor) return;
  const tabId = `memory-tab-${item.id}`;
  await host.emit({
    kind: 'create',
    type: 'view-instance',
    props: {
      id: tabId,
      descriptor_id: 'markdown.doc',
      title: item.title,
      query: { types: ['memory'], where: { kind: 'eq', field: 'object_id', value: item.id } } as unknown as JsonValue,
    },
  });
  await host.emit({ kind: 'move', id: tabId, new_parent: editor.id, order: editor.relations?.CONTAINS?.length ?? 0 });
  await host.emit({ kind: 'update', id: editor.id, patch: { active_tab: tabId } });
}

async function activateSurface(host: BlockHost, surfaceId: string): Promise<void> {
  const set = await Promise.resolve(host.query(surfaceQuery()));
  const surfaces = set.objects.filter((object) => object.type === 'surface');
  for (const surface of surfaces) {
    await host.emit({ kind: 'update', id: surface.id, patch: { active: surface.id === surfaceId } });
  }
}

function unavailableAction(degradation: Degradation): { label?: string; run?: RowAction } {
  if (degradation.level !== 'unavailable') return {};
  return {
    label: degradation.action?.label,
    run: degradation.action?.run,
  };
}

function SourceRootContent({ row, expandable }: { readonly row: RootRow; readonly expandable: boolean }) {
  const template = row.sourceKind ?? 'memory';
  return (
    <>
      <span aria-hidden className="mr-1 w-3 shrink-0 text-ij-ink-disabled">
        {expandable ? row.expanded ? '▾' : '▸' : ''}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5" data-file-source-template={template}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate" style={{ fontWeight: template === 'project' ? 'var(--rec-weight-cap)' : undefined }}>
            {row.label}
          </span>
          {row.status ? (
            <span
              className="ml-auto shrink-0 pl-2 text-ij-ink-info"
              title={row.statusTitle}
              data-file-root-status={row.id}
              style={{ fontWeight: row.degradation ? 'var(--rec-weight-cap)' : undefined }}
            >
              {row.status}
            </span>
          ) : null}
        </span>
        {row.description || row.degradation ? (
          <span className="truncate text-xs text-ij-ink-info">
            {row.degradation?.cause ?? row.description}
          </span>
        ) : null}
      </span>
      {row.actionLabel ? (
        <span className="ml-2 shrink-0 rounded-ij-arc-underline border border-ij-control-border px-2 py-0.5 text-xs text-ij-link">
          {row.actionLabel}
        </span>
      ) : null}
    </>
  );
}

function FolderRowContent({ row, expandable }: { readonly row: FolderRow; readonly expandable: boolean }) {
  return (
    <>
      <span aria-hidden className="mr-1 w-3 shrink-0 text-ij-ink-disabled">
        {expandable ? row.expanded ? '▾' : '▸' : ''}
      </span>
      <span className="min-w-0 truncate">{row.label}</span>
    </>
  );
}

function MemoryRowContent({ row }: { readonly row: MemoryRow }) {
  return (
    <>
      <span aria-hidden className="mr-1 w-3 shrink-0 text-ij-ink-disabled">·</span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate">{row.label}</span>
        <span className="truncate text-xs text-ij-ink-info">
          {projectionPathOf(row.item) ? <span className="font-ij-mono" data-mono-ok>{projectionPathOf(row.item)}</span> : 'Memory source'}
        </span>
      </span>
    </>
  );
}

function StateRowContent({ row }: { readonly row: StateRow }) {
  return (
    <>
      <span aria-hidden className="mr-1 w-3 shrink-0 text-ij-ink-disabled">!</span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate">{row.degradation?.cause ?? row.label}</span>
        <span className="truncate text-xs text-ij-ink-info">{row.label}</span>
      </span>
      {row.actionLabel ? (
        <span className="ml-2 shrink-0 rounded-ij-arc-underline border border-ij-control-border px-2 py-0.5 text-xs text-ij-link">
          {row.actionLabel}
        </span>
      ) : null}
    </>
  );
}

export function FilesView({ host }: { host: BlockHost }) {
  const items = useMemoryProjectionStore((state) => state.items);
  const status = useMemoryProjectionStore((state) => state.status);
  const error = useMemoryProjectionStore((state) => state.error);
  const apply = useMemoryProjectionStore((state) => state.apply);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [activeRowId, setActiveRowId] = useState('root-memory');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    void ensureMemoryProjection();
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const controller = new AbortController();
    let reconnectTimer: number | undefined;
    const connect = async () => {
      try {
        const response = await fetch('/api/harness/memory/stream', {
          cache: 'no-store',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`memory changefeed failed: ${response.status}`);
        const parser = createParser({
          onEvent(event: EventSourceMessage) {
            if (event.event !== 'item.upserted' && event.event !== 'item.deleted') return;
            try {
              apply(JSON.parse(event.data) as HarnessMemoryDelta);
            } catch {
              // Malformed deltas are ignored; the next hydration remains authoritative.
            }
          },
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }
      } catch (streamError) {
        if (controller.signal.aborted) return;
        void streamError;
      }
      if (!controller.signal.aborted) {
        reconnectTimer = window.setTimeout(() => void connect(), DUR.slow * 4);
      }
    };
    void connect();
    return () => {
      controller.abort();
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    };
  }, [apply, status]);

  const rows = useMemo<TreeRow[]>(() => {
    const projectUnavailable = withAction(
      degradationFor('workspace_project_unconnected', 400),
      () => void activateSurface(host, WORKSPACE_SURFACE_ID),
    );
    const memoryUnavailable = withAction(
      degradationFor('harness_memory_projection_unavailable', 400),
      () => void activateSurface(host, ACCOUNT_SURFACE_ID),
    );
    const projectAction = unavailableAction(projectUnavailable);
    const memoryAction = unavailableAction(memoryUnavailable);
    const project: TreeRow[] = [
      {
        id: 'root-project',
        kind: 'root',
        sourceKind: 'project',
        label: 'Project',
        depth: 1,
        expanded: false,
        expandable: false,
        status: 'Connect',
        statusTitle: projectUnavailable.cause,
        description: 'Connect a workspace project to browse source files beside memory.',
        degradation: projectUnavailable,
        actionLabel: projectAction.label,
        action: projectAction.run,
      },
    ];
    const memory = status === 'ready'
      ? buildMemoryRows(items, expanded).map((row) => (
          row.id === 'root-memory'
            ? {
                ...row,
                description: items.length > 0
                  ? 'Pinned projection paths open memory as source tabs.'
                  : 'Adding harness memories makes them openable as source tabs.',
                actionLabel: items.length > 0 ? undefined : 'Open Account',
                action: items.length > 0 ? undefined : () => void activateSurface(host, ACCOUNT_SURFACE_ID),
              }
            : row.kind === 'state'
              ? {
                  ...row,
                  degradation: memoryUnavailable,
                  actionLabel: memoryAction.label,
                  action: memoryAction.run,
                }
              : row
        ))
      : [
          {
            id: 'root-memory',
            kind: 'root' as const,
            sourceKind: 'memory' as const,
            label: 'Harness Memory',
            depth: 1,
            expanded: false,
            expandable: false,
            status: status === 'loading' ? 'Loading' : 'Unavailable',
            statusTitle: status === 'loading'
              ? 'Loading tenant memory projection.'
              : `Harness Memory unavailable: ${error ?? 'Harness GraphQL is not connected.'}`,
            description: status === 'loading'
              ? 'Hydrating the memory projection from the harness.'
              : memoryUnavailable.cause,
            degradation: status === 'loading' ? undefined : memoryUnavailable,
            actionLabel: status === 'loading' ? undefined : memoryAction.label,
            action: status === 'loading' ? undefined : memoryAction.run,
          },
        ];
    const uploads: TreeRow[] = [
      {
        id: 'root-uploads',
        kind: 'root',
        sourceKind: 'uploads',
        label: 'Uploads',
        depth: 1,
        expanded: false,
        expandable: false,
        status: 'Ingest',
        statusTitle: 'Add source files from this device.',
        description: 'Adding a source gives Indexer and Memory material to cite.',
        actionLabel: 'Ingest upload',
        action: () => uploadInputRef.current?.click(),
      },
    ];
    return [...project, ...memory, ...uploads];
  }, [error, expanded, host, items, status]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });
  const focusableRows = rows.filter((row) => row.kind !== 'state' || Boolean(row.action));
  const effectiveActiveRowId = focusableRows.some((row) => row.id === activeRowId)
    ? activeRowId
    : focusableRows[0]?.id;
  const focusRow = (id: string) => {
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return;
    setActiveRowId(id);
    virtualizer.scrollToIndex(index, { align: 'auto' });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => rowRefs.current.get(id)?.focus());
    });
  };
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-ij-chrome" data-files-view>
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="sr-only"
        aria-label="Ingest upload"
        onChange={(event) => {
          event.currentTarget.value = '';
        }}
      />
      <div ref={scrollRef} role="tree" aria-label="Files" className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const expandable = (row.kind === 'root' || row.kind === 'folder') && row.expandable !== false;
            const action = row.kind === 'root' || row.kind === 'state' ? row.action : undefined;
            return (
              <button
                key={row.id}
                type="button"
                role="treeitem"
                aria-level={row.depth}
                aria-label={(row.kind === 'root' || row.kind === 'folder') && row.status
                  ? `${row.label}, ${row.status}`
                  : undefined}
                aria-selected={row.id === effectiveActiveRowId}
                aria-expanded={expandable ? row.expanded : undefined}
                disabled={row.kind === 'state' && !row.action}
                tabIndex={row.id === effectiveActiveRowId ? 0 : -1}
                ref={(node) => {
                  if (node) rowRefs.current.set(row.id, node);
                  else rowRefs.current.delete(row.id);
                }}
                onFocus={() => setActiveRowId(row.id)}
                onClick={() => action ? action() : expandable ? toggle(row.id) : row.kind === 'memory' ? void openMemoryTab(host, row.item) : undefined}
                onKeyDown={(event) => {
                  const focusIndex = focusableRows.findIndex((entry) => entry.id === row.id);
                  if (event.key === 'ArrowDown' && focusIndex < focusableRows.length - 1) {
                    event.preventDefault();
                    focusRow(focusableRows[focusIndex + 1].id);
                    return;
                  }
                  if (event.key === 'ArrowUp' && focusIndex > 0) {
                    event.preventDefault();
                    focusRow(focusableRows[focusIndex - 1].id);
                    return;
                  }
                  if (event.key === 'Home' && focusableRows.length > 0) {
                    event.preventDefault();
                    focusRow(focusableRows[0].id);
                    return;
                  }
                  if (event.key === 'End' && focusableRows.length > 0) {
                    event.preventDefault();
                    focusRow(focusableRows[focusableRows.length - 1].id);
                    return;
                  }
                  if (action && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    action();
                    return;
                  }
                  if (!expandable) return;
                  if (event.key === 'ArrowRight' && !row.expanded) {
                    event.preventDefault();
                    toggle(row.id);
                  }
                  if (event.key === 'ArrowLeft' && row.expanded) {
                    event.preventDefault();
                    toggle(row.id);
                  }
                }}
                className="absolute left-0 flex min-h-ij-row w-full items-center pr-2 text-left text-ij-ink hover:bg-ij-hover-surface disabled:text-ij-ink-info"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingLeft: `calc(var(--rec-grid) * ${row.depth * 3})`,
                }}
              >
                {row.kind === 'root' ? (
                  <SourceRootContent row={row} expandable={expandable} />
                ) : row.kind === 'folder' ? (
                  <FolderRowContent row={row} expandable={expandable} />
                ) : row.kind === 'memory' ? (
                  <MemoryRowContent row={row} />
                ) : (
                  <StateRowContent row={row} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
