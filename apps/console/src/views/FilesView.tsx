'use client';

// SOURCING: 21st.dev builduilabs filesystem-item behavior extraction and
// @tanstack/react-virtual. The tree is rebuilt on Int UI tokens and the APG
// tree contract. Live Harness memory is never mapped into invented folders:
// only the engine-owned pinned projection_path creates hierarchy.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { BlockHost, JsonValue, ObjectRef } from '@commonplace/block-view/types';
import { surfaceQuery } from '@commonplace/block-view/surface-tree';
import {
  projectionPathOf,
  useMemoryProjectionStore,
  type HarnessMemoryDelta,
  type HarnessMemoryItem,
} from '@/lib/memory-projection-store';

type TreeRow =
  | { readonly id: string; readonly kind: 'root' | 'folder'; readonly label: string; readonly depth: number; readonly expanded: boolean }
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
  const rows: TreeRow[] = [{ id: root.id, kind: 'root', label: root.label, depth: 1, expanded: expanded.has(root.id) }];
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
  if (items.length === 0) rows.push({ id: 'memory-empty', kind: 'state', label: 'No memory projections.', depth: 2 });
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

function errorName(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload) return String(payload.error);
  return 'memory_projection_unavailable';
}

export function FilesView({ host }: { host: BlockHost }) {
  const items = useMemoryProjectionStore((state) => state.items);
  const status = useMemoryProjectionStore((state) => state.status);
  const error = useMemoryProjectionStore((state) => state.error);
  const apply = useMemoryProjectionStore((state) => state.apply);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(['root-project', 'root-memory', 'root-uploads']),
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const projection = useMemoryProjectionStore.getState();
    if (projection.status === 'ready') return;
    projection.begin();
    let active = true;
    void fetch('/api/harness/memory', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { tenant?: string; items?: HarnessMemoryItem[]; error?: string };
        if (!active) return;
        if (!response.ok || !payload.tenant || !Array.isArray(payload.items)) {
          const refused = response.status === 400 || response.status === 401 || response.status === 403;
          useMemoryProjectionStore.getState().fail(refused ? 'refused' : 'unavailable', errorName(payload));
          return;
        }
        useMemoryProjectionStore.getState().hydrate(payload.tenant, payload.items);
      })
      .catch(() => {
        if (active) useMemoryProjectionStore.getState().fail('unavailable', 'harness_graphql_unreachable');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const source = new EventSource('/api/harness/memory/stream');
    const onDelta = (event: MessageEvent<string>) => {
      try {
        apply(JSON.parse(event.data) as HarnessMemoryDelta);
      } catch {
        // Malformed deltas are ignored; the next hydration remains authoritative.
      }
    };
    source.addEventListener('item.upserted', onDelta as EventListener);
    source.addEventListener('item.deleted', onDelta as EventListener);
    return () => source.close();
  }, [apply, status]);

  const rows = useMemo<TreeRow[]>(() => {
    const project: TreeRow[] = [
      { id: 'root-project', kind: 'root', label: 'Project', depth: 1, expanded: expanded.has('root-project') },
      ...(expanded.has('root-project')
        ? [{ id: 'project-unavailable', kind: 'state' as const, label: 'Unavailable: no project context is connected.', depth: 2 }]
        : []),
    ];
    const memory = status === 'ready'
      ? buildMemoryRows(items, expanded)
      : [
          { id: 'root-memory', kind: 'root' as const, label: 'Harness Memory', depth: 1, expanded: expanded.has('root-memory') },
          ...(expanded.has('root-memory')
            ? [{
                id: 'memory-state',
                kind: 'state' as const,
                depth: 2,
                label: status === 'loading'
                  ? 'Loading tenant memory projection.'
                  : `Unavailable: ${error ?? 'Harness GraphQL is not connected.'}`,
              }]
            : []),
        ];
    const uploads: TreeRow[] = [
      { id: 'root-uploads', kind: 'root', label: 'Uploads', depth: 1, expanded: expanded.has('root-uploads') },
      ...(expanded.has('root-uploads')
        ? [{ id: 'uploads-empty', kind: 'state' as const, label: 'No uploads.', depth: 2 }]
        : []),
    ];
    return [...project, ...memory, ...uploads];
  }, [error, expanded, items, status]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 12,
  });
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-ij-chrome" data-files-view>
      <div className="flex h-ij-control shrink-0 items-center border-b border-ij-seam px-2 text-ij-ink-info">
        <span>{items.length} memory items</span>
        <span className="ml-auto font-ij-mono">{status}</span>
      </div>
      <div ref={scrollRef} role="tree" aria-label="Files" className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const expandable = row.kind === 'root' || row.kind === 'folder';
            return (
              <button
                key={row.id}
                type="button"
                role="treeitem"
                aria-level={row.depth}
                aria-selected={false}
                aria-expanded={expandable ? row.expanded : undefined}
                disabled={row.kind === 'state'}
                onClick={() => expandable ? toggle(row.id) : row.kind === 'memory' ? void openMemoryTab(host, row.item) : undefined}
                onKeyDown={(event) => {
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
