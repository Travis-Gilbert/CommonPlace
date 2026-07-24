'use client';

// SOURCING: @commonplace/block-view for host and layout object semantics.
// SPEC-CONSOLE-INFORMATION-ARCHITECTURE-1.0: three rail tiers (Places,
// Collections, Pins). Companions are dock panels and stay out of the rail.
// Connection state is owned by StatusBar only (D7).

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { JsonValue, ObjectRef, ObjectSet } from '@commonplace/block-view/types';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { githubTenantSlug } from '@/lib/account-identity';
import { recordBlockMoveReceipts } from '@/lib/block-move-receipts';
import { placeBlockAction } from '@/lib/block-placement';
import { kindHueCss } from '@/lib/material/kind-hues';
import { deriveRailCollections, PLACE_ENTRIES, type RailCollection } from '@/lib/rail/rail-model';
import { ACCOUNT_SURFACE_ID } from '@/lib/workspace-seed';
import { useMotionDurations } from '@/motion/motion-tokens';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import {
  IconAccount,
  IconCards,
  IconChat,
  IconDoc,
  IconFiles,
  IconIndex,
  IconMemory,
  IconRecords,
  IconRun,
  IconThread,
  IconWorkspace,
} from './icons';

export interface SidebarRegion {
  readonly object: ObjectRef;
  readonly instances: readonly ObjectRef[];
}

const PLACE_ICONS: Record<string, typeof IconRecords> = {
  chat: IconChat,
  workspace: IconWorkspace,
  index: IconIndex,
  canvas: IconCards,
  automation: IconRun,
};

const COLLECTION_ICONS: Record<string, typeof IconRecords> = {
  records: IconRecords,
  cards: IconCards,
  thread: IconThread,
  doc: IconDoc,
  files: IconFiles,
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

function shortcutGlyph(index: number): string {
  return `⌘${index + 1}`;
}

function SidebarDivider() {
  return (
    <div
      aria-hidden
      className="h-px w-full shrink-0"
      style={{
        marginBlock: '4px',
        background: 'var(--ij-gray-3)',
      }}
    />
  );
}

function SidebarRowIcon({
  children,
  muted,
  hue,
}: {
  readonly children: React.ReactNode;
  readonly muted?: boolean;
  readonly hue?: string;
}) {
  return (
    <span
      className="flex size-ij-stripe-icon shrink-0 items-center justify-center"
      style={{ color: hue ?? (muted ? 'var(--ij-ink-info)' : 'var(--ij-ink)') }}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function Sidebar({
  host,
  activeSurfaceId,
  compact,
  landmarksRegion,
  activeGridRegionId,
}: {
  readonly host: ConsoleBlockHost;
  readonly surfaces: readonly ObjectRef[];
  readonly companions: readonly SidebarRegion[];
  readonly activeSurfaceId: string;
  readonly compact: boolean;
  readonly landmarksRegion: SidebarRegion | null;
  readonly activeGridRegionId: string | null;
  readonly onToggleCompanion: (region: SidebarRegion) => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const durations = useMotionDurations();
  const persistedCollapsed = landmarksRegion?.object.properties.collapsed === true;
  const [collapseOverride, setCollapseOverride] = useState<boolean | null>(null);
  const collapsed = collapseOverride ?? persistedCollapsed;
  const visuallyCollapsed = compact || collapsed;
  const domainLandmarks = useLandmarkObjects(host);
  const collections = useMemo(() => deriveRailCollections(), []);
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
    setCollapseOverride(next);
    void host.emit({
      kind: 'update',
      id: landmarksRegion.object.id,
      patch: { collapsed: next },
    }).finally(() => setCollapseOverride(null));
  }, [collapsed, host, landmarksRegion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'b') return;
      event.preventDefault();
      toggleCollapse();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleCollapse]);

  const navigateTo = useCallback((surfaceId: string, path: string) => {
    void host.activateSurface(surfaceId);
    router.push(path);
  }, [host, router]);

  const onLandmarkDragEnd = useCallback((event: DragEvent, landmark: ObjectRef) => {
    if (!activeGridRegionId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target?.closest('[data-ground-canvas], [data-region-kind="grid"], [data-region-kind="editor"]')) {
      return;
    }
    const descriptorId = landmark.type === 'view-instance'
      ? String(landmark.properties.descriptor_id ?? '')
      : DESCRIPTOR_FOR_DOMAIN[landmark.type];
    if (!descriptorId) return;
    const instanceId = landmarkInstanceId(landmark);
    const already = seededLandmarks.some((candidate) => candidate.id === instanceId);
    if (!already && landmark.type !== 'view-instance') {
      void host.emit({
        kind: 'create',
        object: {
          id: instanceId,
          type: 'view-instance',
          properties: {
            descriptor_id: descriptorId,
            title: titleFor(landmark, landmark.id),
            query: queryForDomainLandmark(landmark) as unknown as JsonValue,
            order: seededLandmarks.length,
          },
        },
      });
    }
    void placeBlockAction(host, {
      instanceId,
      regionId: activeGridRegionId,
      descriptorId,
    }).then((receipts) => {
      recordBlockMoveReceipts(receipts);
    });
  }, [activeGridRegionId, host, seededLandmarks]);

  const pinLandmark = useCallback((landmark: ObjectRef) => {
    const pinned = landmark.properties.pinned === true;
    void host.emit({
      kind: 'update',
      id: landmark.id,
      patch: { pinned: !pinned },
    });
  }, [host]);

  const removeLandmark = useCallback((landmark: ObjectRef) => {
    if (landmark.type !== 'view-instance') return;
    void host.emit({ kind: 'delete', id: landmark.id });
  }, [host]);

  return (
    <nav
      aria-label="Places, collections, and pins"
      data-paint-region="stripe"
      data-frame-resident="stripe"
      data-shell-region="rail"
      data-sidebar-collapsed={visuallyCollapsed}
      className="flex w-ij-stripe shrink-0 flex-col bg-transparent font-ij-ui"
      style={{
        padding: 'var(--ij-sidebar-pad)',
        gap: 'var(--ij-sidebar-zone-gap)',
        transition: durations.reduced ? undefined : 'width var(--ij-motion) var(--ij-ease)',
      }}
    >
      <div
        data-surface-rail
        data-rail-tier="place"
        role="radiogroup"
        aria-label="Places"
        className="flex flex-col"
        style={{ gap: 'var(--ij-sidebar-row-gap)' }}
      >
        {PLACE_ENTRIES.map((place, index) => {
          const Icon = PLACE_ICONS[place.kind] ?? IconWorkspace;
          const active = place.surfaceId === activeSurfaceId;
          return (
            <button
              key={place.id}
              type="button"
              role="radio"
              data-rail-tier="place"
              data-surface-nav={place.surfaceId}
              title={`${place.label} (${shortcutLabel(index)})`}
              aria-label={`${place.label} place`}
              aria-checked={active}
              aria-keyshortcuts={`Control+${index + 1} Meta+${index + 1}`}
              onClick={() => navigateTo(place.surfaceId, place.path)}
              className="group relative flex h-ij-nav-row w-full items-center rounded-ij-sidebar-row text-left hover:bg-ij-hover-surface"
              data-selected={active ? 'true' : undefined}
              style={{
                paddingInline: 'var(--ij-sidebar-pad)',
                gap: 'var(--ij-sidebar-icon-gap)',
                color: 'var(--ij-ink)',
                background: active ? 'var(--ij-selection)' : 'transparent',
                fontWeight: active ? 700 : 600,
                fontSize: 'var(--ij-sidebar-label-size)',
                lineHeight: 'var(--ij-sidebar-label-line)',
              }}
            >
              {visuallyCollapsed && active ? (
                <span aria-hidden className="absolute left-0 h-ij-sidebar-pip w-ij-sidebar-pip bg-ij-accent" />
              ) : null}
              <SidebarRowIcon muted={!active}>
                <Icon size={16} />
              </SidebarRowIcon>
              <span
                className="min-w-0 flex-1 truncate"
                style={{
                  opacity: visuallyCollapsed ? 0 : 1,
                  transition: 'opacity var(--ij-motion) var(--ij-ease)',
                }}
              >
                {place.label}
              </span>
              <span
                className="shrink-0 font-ij-mono tabular-nums"
                style={{
                  opacity: visuallyCollapsed ? 0 : 1,
                  transition: 'opacity var(--ij-motion) var(--ij-ease)',
                  color: 'var(--ij-ink-info)',
                  fontSize: 'var(--ij-sidebar-shortcut-size)',
                  lineHeight: '16px',
                  fontWeight: 400,
                }}
              >
                {shortcutGlyph(index)}
              </span>
            </button>
          );
        })}
      </div>

      <SidebarDivider />

      <div
        data-rail-tier="collection"
        aria-label="Collections"
        className="flex flex-col"
        style={{ gap: 'var(--ij-sidebar-row-gap)' }}
      >
        {collections.map((collection: RailCollection) => {
          const Icon = COLLECTION_ICONS[collection.kindGlyph] ?? IconRecords;
          const active = collection.surfaceId === activeSurfaceId;
          return (
            <button
              key={collection.kindGlyph}
              type="button"
              data-rail-tier="collection"
              data-collection-nav={collection.kindGlyph}
              data-surface-nav={collection.surfaceId}
              title={collection.label}
              aria-label={`${collection.label} collection`}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigateTo(collection.surfaceId, collection.path)}
              className="flex h-ij-nav-row w-full items-center rounded-ij-sidebar-row text-left hover:bg-ij-hover-surface"
              data-selected={active ? 'true' : undefined}
              style={{
                paddingInline: 'var(--ij-sidebar-pad)',
                gap: 'var(--ij-sidebar-icon-gap)',
                color: 'var(--ij-ink)',
                background: active ? 'var(--ij-selection)' : 'transparent',
                fontWeight: active ? 600 : 500,
                fontSize: 'var(--ij-sidebar-label-size)',
                lineHeight: 'var(--ij-sidebar-label-line)',
              }}
            >
              <SidebarRowIcon hue={kindHueCss(collection.kindGlyph)}>
                <Icon size={16} />
              </SidebarRowIcon>
              <span
                className="min-w-0 flex-1 truncate"
                style={{
                  opacity: visuallyCollapsed ? 0 : 1,
                  transition: 'opacity var(--ij-motion) var(--ij-ease)',
                }}
              >
                {collection.label}
              </span>
            </button>
          );
        })}
      </div>

      <SidebarDivider />

      <section
        aria-label="Pins"
        data-rail-tier="pin"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{ gap: '4px' }}
      >
        <h2
          className="font-ij-mono tabular-nums text-ij-ink-info"
          style={{
            paddingInline: 'var(--ij-sidebar-pad)',
            fontSize: 'var(--ij-sidebar-shortcut-size)',
            lineHeight: '16px',
            opacity: visuallyCollapsed ? 0 : 1,
            transition: 'opacity var(--ij-motion) var(--ij-ease)',
          }}
        >
          Pins
        </h2>
        <div className="flex flex-col" style={{ gap: 'var(--ij-sidebar-row-gap)' }}>
          {landmarks.map((landmark) => {
            const descriptorId = String(landmark.properties.descriptor_id ?? '');
            const descriptor = descriptorId
              ? CONSOLE_VIEW_REGISTRY.blocksForPlacement('rail').find((candidate) => candidate.id === descriptorId)
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
                data-rail-tier="pin"
                data-sidebar-landmark={landmark.id}
                className="group flex h-ij-nav-row w-full items-center rounded-ij-sidebar-row hover:bg-ij-hover-surface"
                title={`${label}. Drag to the active grid.`}
                style={{
                  paddingInline: 'var(--ij-sidebar-pad)',
                  gap: 'var(--ij-sidebar-icon-gap)',
                  color: 'var(--ij-ink-info)',
                  fontWeight: 400,
                  fontSize: 'var(--ij-sidebar-label-size)',
                  lineHeight: 'var(--ij-sidebar-label-line)',
                }}
              >
                <SidebarRowIcon muted hue={typeof glyph === 'string' ? kindHueCss(glyph as 'records') : undefined}>
                  <Icon size={16} />
                </SidebarRowIcon>
                <span
                  className="min-w-0 flex-1 truncate"
                  style={{
                    opacity: visuallyCollapsed ? 0 : 1,
                    transition: 'opacity var(--ij-motion) var(--ij-ease)',
                  }}
                >
                  {label}
                </span>
                {!visuallyCollapsed ? (
                  <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      className="text-ij-ink-info hover:text-ij-ink"
                      onClick={() => pinLandmark(landmark)}
                      aria-label={`${landmark.properties.pinned === true ? 'Unpin' : 'Pin'} ${label}`}
                    >
                      {landmark.properties.pinned === true ? 'Unpin' : 'Pin'}
                    </button>
                    {removable ? (
                      <button
                        type="button"
                        className="text-ij-ink-info hover:text-ij-ink"
                        onClick={() => removeLandmark(landmark)}
                        aria-label={`Remove ${label}`}
                      >
                        Remove
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </div>
            );
          })}
          {landmarks.length === 0 && !visuallyCollapsed ? (
            <p
              className="text-ij-ink-info"
              style={{
                paddingInline: 'var(--ij-sidebar-pad)',
                fontSize: 'var(--ij-sidebar-label-size)',
              }}
            >
              No pins yet.
            </p>
          ) : null}
        </div>
      </section>

      <div
        className="mt-auto flex shrink-0 items-center"
        style={{
          height: 'var(--ij-sidebar-footer-h)',
          gap: '8px',
          paddingTop: 'var(--ij-sidebar-pad)',
          paddingRight: '4px',
        }}
      >
        <button
          type="button"
          onClick={toggleCollapse}
          disabled={compact}
          className="flex size-ij-stripe-icon shrink-0 items-center justify-center text-ij-ink-info hover:text-ij-ink disabled:opacity-50"
          title={
            compact
              ? 'Sidebar stays collapsed at this width'
              : collapsed
                ? 'Expand sidebar (Cmd or Ctrl B)'
                : 'Collapse sidebar (Cmd or Ctrl B)'
          }
          aria-label={
            compact
              ? 'Sidebar collapsed for narrow width'
              : collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
          }
        >
          <span aria-hidden>{visuallyCollapsed ? '›' : '‹'}</span>
        </button>
        <span
          className="flex shrink-0 items-center justify-center rounded-full bg-ij-chrome font-semibold text-ij-ink"
          style={{
            width: 'var(--ij-sidebar-avatar)',
            height: 'var(--ij-sidebar-avatar)',
            fontSize: '12px',
            lineHeight: '16px',
          }}
        >
          {initials}
        </span>
        <button
          type="button"
          data-account-trigger
          aria-label="Account"
          aria-pressed={activeSurfaceId === ACCOUNT_SURFACE_ID}
          onClick={() => void host.activateSurface(ACCOUNT_SURFACE_ID)}
          className="flex size-ij-stripe-icon shrink-0 items-center justify-center rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink aria-pressed:bg-ij-selection aria-pressed:text-ij-ink"
          style={{ transition: 'background-color var(--ij-motion) var(--ij-ease), color var(--ij-motion) var(--ij-ease)' }}
          title="Account"
        >
          <IconAccount size={14} />
        </button>
        <span
          className="min-w-0 flex-1 truncate"
          style={{
            opacity: visuallyCollapsed ? 0 : 1,
            transition: 'opacity var(--ij-motion) var(--ij-ease)',
            color: 'var(--ij-ink-info)',
            fontWeight: 500,
            fontSize: 'var(--ij-sidebar-label-size)',
            lineHeight: 'var(--ij-sidebar-label-line)',
          }}
        >
          {tenant}
        </span>
      </div>
    </nav>
  );
}
