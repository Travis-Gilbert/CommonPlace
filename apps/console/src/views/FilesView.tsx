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
import { DUR } from '@/motion/motion-tokens';
import {
  ensureMemoryProjection,
  projectionPathOf,
  useMemoryProjectionStore,
  type HarnessMemoryDelta,
  type HarnessMemoryItem,
} from '@/lib/memory-projection-store';

type TreeRow =
  | {
      readonly id: string;
      readonly kind: 'root' | 'folder';
      readonly label: string;
      readonly depth: number;
      readonly expanded: boolean;
      readonly expandable?: boolean;
      readonly status?: string;
      readonly statusTitle?: string;
    }
  | { readonly id: string; readonly kind: 'memory'; readonly label: string; readonly depth: number; readonly item: HarnessMemoryItem }
  | { readonly id: string; readonly kind: 'state'; readonly label: string; readonly depth: number };

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

export function FilesView({ host }: { host: BlockHost }) {
  const items = useMemoryProjectionStore((state) => state.items);
  const status = useMemoryProjectionStore((state) => state.status);
  const error = useMemoryProjectionStore((state) => state.error);
  const apply = useMemoryProjectionStore((state) => state.apply);
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
    const project: TreeRow[] = [
      {
        id: 'root-project',
        kind: 'root',
        label: 'Project',
        depth: 1,
        expanded: false,
        expandable: false,
        status: 'Not connected',
        statusTitle: 'Project context is not connected.',
      },
    ];
    const memory = status === 'ready'
      ? buildMemoryRows(items, expanded)
      : [
          {
            id: 'root-memory',
            kind: 'root' as const,
            label: 'Harness Memory',
            depth: 1,
            expanded: false,
            expandable: false,
            status: status === 'loading' ? 'Loading' : 'Unavailable',
            statusTitle: status === 'loading'
              ? 'Loading tenant memory projection.'
              : `Harness Memory unavailable: ${error ?? 'Harness GraphQL is not connected.'}`,
          },
        ];
    const uploads: TreeRow[] = [
      {
        id: 'root-uploads',
        kind: 'root',
        label: 'Uploads',
        depth: 1,
        expanded: false,
        expandable: false,
        status: 'Empty',
        statusTitle: 'No uploads yet.',
      },
    ];
    return [...project, ...memory, ...uploads];
  }, [error, expanded, items, status]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 12,
  });
  const focusableRows = rows.filter((row) => row.kind !== 'state');
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
      <div ref={scrollRef} role="tree" aria-label="Files" className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const expandable = (row.kind === 'root' || row.kind === 'folder') && row.expandable !== false;
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
                disabled={row.kind === 'state'}
                tabIndex={row.id === effectiveActiveRowId ? 0 : -1}
                ref={(node) => {
                  if (node) rowRefs.current.set(row.id, node);
                  else rowRefs.current.delete(row.id);
                }}
                onFocus={() => setActiveRowId(row.id)}
                onClick={() => expandable ? toggle(row.id) : row.kind === 'memory' ? void openMemoryTab(host, row.item) : undefined}
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
                className="absolute left-0 flex h-ij-row w-full items-center pr-2 text-left text-ij-ink hover:bg-ij-hover-surface disabled:text-ij-ink-info"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingLeft: `calc(var(--rec-grid) * ${row.depth * 3})`,
                }}
              >
                <span aria-hidden className="mr-1 w-3 text-ij-ink-disabled">
                  {expandable ? row.expanded ? '▾' : '▸' : row.kind === 'memory' ? '·' : ''}
                </span>
                <span className="truncate">{row.label}</span>
                {(row.kind === 'root' || row.kind === 'folder') && row.status ? (
                  <span
                    className="ml-auto shrink-0 pl-2 font-ij-mono text-ij-ink-info"
                    title={row.statusTitle}
                    data-file-root-status={row.id}
                  >
                    {row.status}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
