'use client';

// SOURCING: @commonplace/block-view for host and layout object semantics.
// The sidebar is frame chrome. Native drag events provide the landmark to
// ground promotion behavior; island moves remain receipted through the host.

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { JsonValue, ObjectRef, ObjectSet } from '@commonplace/block-view/types';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { pathForSurfaceKind } from '@/lib/surface-routes';
import { githubTenantSlug } from '@/lib/account-identity';
import { recordIslandMoveReceipts } from '@/lib/island-move-receipts';
import { promoteIslandAction } from '@/lib/island-promotion';
import { useMotionDurations } from '@/motion/motion-tokens';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import {
  IconCards,
  IconChat,
  IconDoc,
  IconFiles,
  IconIndex,
  IconMemory,
  IconModel,
  IconRecords,
  IconThread,
  IconWorkspace,
} from './icons';

export interface SidebarRegion {
  readonly object: ObjectRef;
  readonly instances: readonly ObjectRef[];
}

const SURFACE_ICONS: Record<string, typeof IconRecords> = {
  chat: IconChat,
  workspace: IconWorkspace,
  index: IconIndex,
  model: IconModel,
  documents: IconDoc,
  cards: IconCards,
};

const REGION_ICONS: Record<string, typeof IconRecords> = {
  files: IconFiles,
  context: IconMemory,
  thread: IconThread,
};

const LANDMARK_ICONS: Record<string, typeof IconRecords> = {
  records: IconRecords,
  doc: IconDoc,
  code: IconFiles,
  thread: IconThread,
  cards: IconCards,
  files: IconFiles,
  context: IconMemory,
};

const LANDMARK_TYPES = ['record', 'doc', 'code-file'] as const;

const DESCRIPTOR_FOR_DOMAIN: Record<string, string> = {
  record: 'record.table',
  doc: 'markdown.doc',
  'code-file': 'code.file',
};

function titleFor(object: ObjectRef, fallback: string): string {
  const title = object.properties.title ?? object.properties.name ?? object.properties.path;
  return typeof title === 'string' && title.length > 0 ? title : fallback;
}

function landmarkInstanceId(landmark: ObjectRef): string {
  if (landmark.type === 'view-instance') return landmark.id;
  return `console.landmark-${landmark.type}-${landmark.id}`;
}

function queryForDomainLandmark(landmark: ObjectRef) {
  return {
    types: [landmark.type],
    where: { kind: 'eq' as const, field: 'id', value: landmark.id },
    page: { limit: 1 },
  };
}

function useLandmarkObjects(host: ConsoleBlockHost): readonly ObjectRef[] {
  const [objects, setObjects] = useState<readonly ObjectRef[]>([]);

  useEffect(() => {
    let active = true;
    const pinnedQuery = {
      types: [...LANDMARK_TYPES],
      where: { kind: 'eq' as const, field: 'pinned', value: true },
      rank: [{ kind: 'field' as const, field: 'updated', direction: 'desc' as const }],
      page: { limit: 12 },
      live: true,
    };
    const recentQuery = {
      types: [...LANDMARK_TYPES],
      rank: [{ kind: 'field' as const, field: 'updated', direction: 'desc' as const }],
      page: { limit: 12 },
      live: true,
    };
    let unsubscribePinned = () => {};
    let unsubscribeRecent = () => {};
    let pinned: readonly ObjectRef[] = [];
    let recent: readonly ObjectRef[] = [];

    const publish = () => {
      if (!active) return;
      const seen = new Set<string>();
      setObjects([...pinned, ...recent].filter((object) => {
        if (seen.has(object.id)) return false;
        seen.add(object.id);
        return true;
      }).slice(0, 12));
    };
    const bind = (
      result: ObjectSet | Promise<ObjectSet>,
      assign: (next: readonly ObjectRef[]) => void,
      setUnsubscribe: (unsubscribe: () => void) => void,
    ) => {
      void Promise.resolve(result).then((set) => {
        if (!active) return;
        assign(set.objects);
        publish();
        setUnsubscribe(set.subscribe((next) => {
          assign(next.objects);
          publish();
        }));
      }).catch(() => {
        if (!active) return;
        assign([]);
        publish();
      });
    };

    bind(host.query(pinnedQuery), (next) => { pinned = next; }, (next) => { unsubscribePinned = next; });
    bind(host.query(recentQuery), (next) => { recent = next; }, (next) => { unsubscribeRecent = next; });
    return () => {
      active = false;
      unsubscribePinned();
      unsubscribeRecent();
    };
  }, [host]);

  return objects;
}

function shortcutLabel(index: number): string {
  return `Cmd or Ctrl ${index + 1}`;
}

function SidebarDivider() {
  return <div aria-hidden className="my-1 h-px w-full shrink-0 bg-ij-seam" />;
}

export function Sidebar({
  host,
  surfaces,
  companions,
  activeSurfaceId,
  landmarksRegion,
  activeGridRegionId,
  onToggleCompanion,
}: {
  readonly host: ConsoleBlockHost;
  readonly surfaces: readonly ObjectRef[];
  readonly companions: readonly SidebarRegion[];
  readonly activeSurfaceId: string;
  readonly landmarksRegion: SidebarRegion | null;
  readonly activeGridRegionId: string | null;
  readonly onToggleCompanion: (region: SidebarRegion) => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const durations = useMotionDurations();
  const [collapsed, setCollapsed] = useState(() => landmarksRegion?.object.properties.collapsed === true);
  const domainLandmarks = useLandmarkObjects(host);
  const routedSurfaces = useMemo(
    () => surfaces
      .filter((surface) => pathForSurfaceKind(String(surface.properties.kind ?? '')) !== null)
      .sort((a, b) => Number(a.properties.stripe_order ?? 99) - Number(b.properties.stripe_order ?? 99)),
    [surfaces],
  );
  const seededLandmarks = landmarksRegion?.instances ?? [];
  const landmarks = domainLandmarks.length > 0 ? domainLandmarks : seededLandmarks;
  const tenant = githubTenantSlug(session?.user?.githubLogin) ?? 'Local tenant';
  const initials = (session?.user?.name ?? session?.user?.githubLogin ?? 'CP')
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const toggleCollapse = useCallback(() => {
    if (!landmarksRegion) return;
    const next = !collapsed;
    setCollapsed(next);
    void host.emit({ kind: 'update', id: landmarksRegion.object.id, patch: { collapsed: next } });
  }, [collapsed, host, landmarksRegion]);

  const switchTo = useCallback((surface: ObjectRef) => {
    if (surface.id === activeSurfaceId) return;
    const path = pathForSurfaceKind(String(surface.properties.kind ?? ''));
    if (path) {
      // Route first: the pathname effect activates the matching surface. Calling
      // activateSurface before the URL settles races the effect and reverts.
      router.push(path);
      return;
    }
    void host.activateSurface(surface.id);
  }, [activeSurfaceId, host, router]);

  useEffect(() => {
    setCollapsed(landmarksRegion?.object.properties.collapsed === true);
  }, [landmarksRegion?.object.properties.collapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleCollapse();
        return;
      }
      const index = Number(event.key) - 1;
      const surface = routedSurfaces[index];
      if (index >= 0 && surface) {
        event.preventDefault();
        switchTo(surface);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [routedSurfaces, switchTo, toggleCollapse]);

  const ensureLandmarkInstance = useCallback(async (landmark: ObjectRef): Promise<string | null> => {
    if (landmark.type === 'view-instance') return landmark.id;
    if (!landmarksRegion) return null;
    const instanceId = landmarkInstanceId(landmark);
    const already = seededLandmarks.some((candidate) => candidate.id === instanceId);
    if (!already) {
      const descriptorId = DESCRIPTOR_FOR_DOMAIN[landmark.type] ?? 'record.table';
      const created = await host.emit({
        kind: 'create',
        type: 'view-instance',
        props: {
          id: instanceId,
          descriptor_id: descriptorId,
          title: titleFor(landmark, landmark.id),
          query: queryForDomainLandmark(landmark) as unknown as JsonValue,
          config: { size: 'm' } as unknown as JsonValue,
        },
      });
      if (!created.ok) return null;
      const parented = await host.emit({
        kind: 'move',
        id: instanceId,
        new_parent: landmarksRegion.object.id,
        order: seededLandmarks.length,
      });
      if (!parented.ok) return null;
    }
    return instanceId;
  }, [host, landmarksRegion, seededLandmarks]);

  const promoteToGround = useCallback(async (instanceId: string) => {
    if (!activeGridRegionId) return;
    let moves = 0;
    for (const action of promoteIslandAction(instanceId, {
      kind: 'grid',
      regionId: activeGridRegionId,
      order: 0,
    })) {
      const result = await host.emit(action);
      if (result.ok && result.value?.action_kind === 'move' && result.value.status === 'applied') moves += 1;
    }
    if (moves > 0) recordIslandMoveReceipts(moves);
  }, [activeGridRegionId, host]);

  const onLandmarkDragEnd = useCallback((event: DragEvent<HTMLDivElement>, landmark: ObjectRef) => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    void (async () => {
      const instanceId = await ensureLandmarkInstance(landmark);
      if (!instanceId) return;
      if (target?.closest('[data-island-arrangement]')) {
        await promoteToGround(instanceId);
        return;
      }
      const overLandmarkId = target?.closest<HTMLElement>('[data-sidebar-landmark]')?.dataset.sidebarLandmark;
      if (!landmarksRegion || !overLandmarkId || overLandmarkId === landmark.id) return;
      const over = landmarks.find((candidate) => candidate.id === overLandmarkId);
      if (!over) return;
      const overInstanceId = await ensureLandmarkInstance(over);
      if (!overInstanceId || overInstanceId === instanceId) return;
      const orderedIds = landmarks
        .map((candidate) => (candidate.id === landmark.id ? instanceId : landmarkInstanceId(candidate)))
        .filter((id) => id !== instanceId);
      const order = orderedIds.findIndex((id) => id === overInstanceId);
      await host.emit({
        kind: 'move',
        id: instanceId,
        new_parent: landmarksRegion.object.id,
        order: order < 0 ? orderedIds.length : order,
      });
    })();
  }, [ensureLandmarkInstance, host, landmarks, landmarksRegion, promoteToGround]);

  const pinLandmark = useCallback((landmark: ObjectRef) => {
    void host.emit({ kind: 'update', id: landmark.id, patch: { pinned: landmark.properties.pinned !== true } });
  }, [host]);

  const removeLandmark = useCallback((landmark: ObjectRef) => {
    if (landmark.type !== 'view-instance') return;
    void host.emit({ kind: 'delete', id: landmark.id });
  }, [host]);

  return (
    <nav
      aria-label="Surfaces and companions"
      data-paint-region="stripe"
      data-frame-resident="stripe"
      data-sidebar-collapsed={collapsed}
      className="flex w-ij-stripe shrink-0 flex-col bg-transparent p-2 font-ij-ui"
      style={{ transition: durations.reduced ? undefined : 'width var(--ij-motion) var(--ij-ease)' }}
    >
      <div data-surface-rail role="radiogroup" aria-label="Surfaces" className="flex flex-col gap-0.5">
        {routedSurfaces.map((surface, index) => {
          const kind = String(surface.properties.kind ?? '');
          const label = titleFor(surface, surface.id);
          const Icon = SURFACE_ICONS[kind] ?? IconWorkspace;
          const active = surface.id === activeSurfaceId;
          return (
            <button
              key={surface.id}
              type="button"
              role="radio"
              data-surface-nav={surface.id}
              title={`${label} (${shortcutLabel(index)})`}
              aria-label={`${label} surface`}
              aria-checked={active}
              aria-keyshortcuts={`Control+${index + 1} Meta+${index + 1}`}
              onClick={() => switchTo(surface)}
              className="group relative flex h-ij-nav-row items-center rounded-ij-sidebar-row px-2 text-left hover:bg-ij-hover-surface"
              style={{
                color: active ? 'var(--ij-ink)' : 'var(--ij-ink-info)',
                background: active ? 'var(--ij-selection)' : 'transparent',
              }}
            >
              {collapsed && active ? <span aria-hidden className="absolute left-0 h-ij-sidebar-pip w-ij-sidebar-pip bg-ij-accent" /> : null}
              <span className="flex size-ij-stripe-icon shrink-0 items-center justify-center"><Icon size={16} /></span>
              <span
                className="min-w-0 flex-1 truncate pl-2 text-sm"
                style={{ opacity: collapsed ? 0 : 1, transition: 'opacity var(--ij-motion) var(--ij-ease)', fontWeight: active ? 600 : 500 }}
              >
                {label}
              </span>
              <span
                className="shrink-0 font-ij-mono text-ij-island-meta text-ij-ink-info"
                style={{ opacity: collapsed ? 0 : 1, transition: 'opacity var(--ij-motion) var(--ij-ease)' }}
              >
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>

      <SidebarDivider />

      <div aria-label="Companions" className="flex flex-col gap-0.5">
        {companions.map((region, index) => {
          const companion = String(region.object.properties.companion ?? '');
          const label = titleFor(region.object, companion);
          const Icon = REGION_ICONS[companion] ?? IconRecords;
          const open = region.object.properties.open !== false;
          return (
            <button
              key={region.object.id}
              type="button"
              data-companion-nav={companion}
              title={`${label} (Alt+Shift+${index + 1})`}
              aria-label={`${label} companion`}
              aria-pressed={open}
              aria-keyshortcuts={`Alt+Shift+${index + 1}`}
              onClick={() => onToggleCompanion(region)}
              className="flex h-ij-nav-row items-center rounded-ij-sidebar-row px-2 text-left hover:bg-ij-hover-surface"
              style={{ color: open ? 'var(--ij-ink)' : 'var(--ij-ink-info)', background: open ? 'var(--ij-selection)' : 'transparent' }}
            >
              <span className="flex size-ij-stripe-icon shrink-0 items-center justify-center"><Icon size={16} /></span>
              <span className="min-w-0 flex-1 truncate pl-2 text-sm" style={{ opacity: collapsed ? 0 : 1, transition: 'opacity var(--ij-motion) var(--ij-ease)' }}>{label}</span>
            </button>
          );
        })}
      </div>

      <SidebarDivider />

      <section aria-label="Landmarks" className="min-h-0 flex-1 overflow-y-auto">
        <h2 className="px-2 font-ij-mono text-ij-island-meta text-ij-ink-info" style={{ opacity: collapsed ? 0 : 1, transition: 'opacity var(--ij-motion) var(--ij-ease)' }}>
          Landmarks
        </h2>
        <div className="mt-1 flex flex-col gap-0.5">
          {landmarks.map((landmark) => {
            const descriptorId = String(landmark.properties.descriptor_id ?? '');
            const descriptor = descriptorId
              ? CONSOLE_VIEW_REGISTRY.blocksForMount('stripe').find((candidate) => candidate.id === descriptorId)
              : undefined;
            const glyph = descriptor?.block?.kindGlyph ?? String(landmark.properties.kind ?? 'records');
            const Icon = LANDMARK_ICONS[glyph] ?? IconRecords;
            const label = titleFor(landmark, descriptor?.name ?? landmark.id);
            const removable = landmark.type === 'view-instance';
            return (
              <div
                key={landmark.id}
                draggable
                onDragEnd={(event) => onLandmarkDragEnd(event, landmark)}
                data-sidebar-landmark={landmark.id}
                className="group flex h-ij-nav-row items-center rounded-ij-sidebar-row px-2 text-ij-ink-info hover:bg-ij-hover-surface"
                title={`${label}. Drag to the active grid.`}
              >
                <span className="flex size-ij-stripe-icon shrink-0 items-center justify-center"><Icon size={16} /></span>
                <span className="min-w-0 flex-1 truncate pl-2 text-sm" style={{ opacity: collapsed ? 0 : 1, transition: 'opacity var(--ij-motion) var(--ij-ease)' }}>{label}</span>
                {!collapsed ? (
                  <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" className="text-ij-ink-info hover:text-ij-ink" onClick={() => pinLandmark(landmark)} aria-label={`${landmark.properties.pinned === true ? 'Unpin' : 'Pin'} ${label}`}>
                      {landmark.properties.pinned === true ? 'Unpin' : 'Pin'}
                    </button>
                    {removable ? <button type="button" className="text-ij-ink-info hover:text-ij-ink" onClick={() => removeLandmark(landmark)} aria-label={`Remove ${label}`}>Remove</button> : null}
                  </span>
                ) : null}
              </div>
            );
          })}
          {landmarks.length === 0 && !collapsed ? <p className="px-2 text-sm text-ij-ink-info">No landmarks yet.</p> : null}
        </div>
      </section>

      <div className="mt-2 flex items-center gap-2 px-2 text-ij-ink-info">
        <button type="button" onClick={toggleCollapse} className="flex size-ij-stripe-icon shrink-0 items-center justify-center text-ij-ink-info hover:text-ij-ink" title={collapsed ? 'Expand sidebar (Cmd or Ctrl B)' : 'Collapse sidebar (Cmd or Ctrl B)'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <span aria-hidden>{collapsed ? '›' : '‹'}</span>
        </button>
        <span className="flex size-ij-control shrink-0 items-center justify-center rounded-full bg-ij-raised text-sm text-ij-ink">{initials}</span>
        <span className="min-w-0 truncate text-sm" style={{ opacity: collapsed ? 0 : 1, transition: 'opacity var(--ij-motion) var(--ij-ease)' }}>{tenant}</span>
      </div>
    </nav>
  );
}
