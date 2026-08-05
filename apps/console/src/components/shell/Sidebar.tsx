'use client';

// SOURCING: @commonplace/block-view for host and layout object semantics.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 CS11/CS12: Views (launch five), Blocks,
// Objects, Pins. Layout switcher lives in the sidebar header. Selection is a
// sunken well plus full-strength ink, not a saturated fill.

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { JsonValue, ObjectRef, ObjectSet } from '@commonplace/block-view/types';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { softNavigate } from '@/lib/soft-navigate';
import { githubTenantSlug } from '@/lib/account-identity';
import { recordBlockMoveReceipts } from '@/lib/block-move-receipts';
import { placeBlockAction } from '@/lib/block-placement';
import {
  deriveBlockPaletteItems,
  PLACE_ENTRIES,
  type BlockPaletteItem,
} from '@/lib/rail/rail-model';
import {
  ACCOUNT_SURFACE_ID,
  CONSOLE_DATA_SURFACE_ID,
} from '@/lib/workspace-seed';
import {
  deriveLabel,
  hostPropsToNavItem,
  NAV_ITEM_TYPE,
  type NavItem,
} from '@/lib/navigationRegistry';
import { useMotionDurations } from '@/motion/motion-tokens';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import {
  TwoLevelSidebarShell,
  type TwoLevelSidebarItem,
} from '@/components/ui/sidebar-component';
import { LayoutSwitcher } from './LayoutSwitcher';
import {
  IconAccount,
  IconCards,
  IconChat,
  IconDoc,
  IconFiles,
  IconIndex,
  IconMemory,
  IconModel,
  IconRecords,
  IconRail,
  IconSearch,
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
  survey: IconMemory,
  index: IconIndex,
  editor: IconWorkspace,
  model: IconModel,
  ide: IconFiles,
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

const BLOCK_ICONS: Record<string, typeof IconRecords> = {
  index: IconRail,
  'data-model': IconModel,
  plan: IconModel,
  records: IconRecords,
  automation: IconRail,
  filing: IconDoc,
  documents: IconDoc,
  files: IconWorkspace,
  canvas: IconCards,
  search: IconSearch,
};

const LANDMARK_TYPES = ['record', 'doc', 'code-file'] as const;

const DESCRIPTOR_FOR_DOMAIN: Record<string, string> = {
  record: 'record.table',
  doc: 'markdown.doc',
  'code-file': 'code.file',
};

const SELECTION_STYLE = {
  background: 'var(--paper-sunken, var(--ij-editor))',
  color: 'var(--ij-ink)',
  boxShadow: 'inset 0 0 0 1px var(--ij-seam)',
} as const;

function titleFor(object: ObjectRef, fallback: string): string {
  const title = object.properties.title ?? object.properties.name ?? object.properties.path;
  return typeof title === 'string' && title.length > 0 ? title : fallback;
}

function pinLabel(landmark: ObjectRef, fallbackName: string): string {
  const title = titleFor(landmark, '');
  if (title && title.length > 0 && title !== landmark.id) return title;
  const type = landmark.type || 'object';
  return `${type} ${landmark.id}`;
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
    let unsubscribePinned = () => {};
    const bind = (
      result: ObjectSet | Promise<ObjectSet>,
      setUnsubscribe: (unsubscribe: () => void) => void,
    ) => {
      void Promise.resolve(result).then((set) => {
        if (!active) return;
        setObjects(set.objects.slice(0, 12));
        setUnsubscribe(set.subscribe((next) => {
          setObjects(next.objects.slice(0, 12));
        }));
      }).catch(() => {
        if (!active) return;
        setObjects([]);
      });
    };

    bind(host.query(pinnedQuery), (next) => { unsubscribePinned = next; });
    return () => {
      active = false;
      unsubscribePinned();
    };
  }, [host]);

  return objects;
}

/** CP3: Objects section reads navigation items as data, not a hardcoded list. */
function useNavigationObjectItems(
  host: ConsoleBlockHost,
  viewerUserId: string,
): readonly { readonly id: string; readonly label: string; readonly objectTypeId: string }[] {
  const [items, setItems] = useState<readonly NavItem[]>([]);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const publish = (objects: readonly ObjectRef[]) => {
      if (!active) return;
      const next = objects
        .map((object) => hostPropsToNavItem(object.properties, object.id))
        .filter((item): item is NavItem => item !== null)
        .filter((item) => {
          if (item.scope.kind === 'workspace') return true;
          return item.scope.userId === viewerUserId;
        })
        .filter((item) => item.itemKind.kind === 'object')
        .sort((a, b) => a.position - b.position);
      setItems(next);
    };
    void Promise.resolve(host.query({ types: [NAV_ITEM_TYPE], live: true })).then((set) => {
      if (!active) return;
      publish(set.objects);
      unsubscribe = set.subscribe((next) => publish(next.objects));
    }).catch(() => {
      if (!active) return;
      setItems([]);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [host, viewerUserId]);

  return useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        objectTypeId: item.itemKind.kind === 'object' ? item.itemKind.objectTypeId : '',
        label: deriveLabel(item.itemKind),
      })),
    [items],
  );
}

function shortcutLabel(index: number): string {
  return `Cmd or Ctrl ${index + 1}`;
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
}: {
  readonly children: React.ReactNode;
  readonly muted?: boolean;
}) {
  return (
    <span
      className="flex size-ij-stripe-icon shrink-0 items-center justify-center"
      style={{ color: muted ? 'var(--ij-ink-info)' : 'var(--ij-ink)' }}
      aria-hidden
    >
      {children}
    </span>
  );
}

function SidebarGroupLabel({ children, hidden }: { children: React.ReactNode; hidden?: boolean }) {
  return (
    <h2
      className="text-ij-ink-info"
      style={{
        paddingInline: 'var(--ij-sidebar-pad)',
        fontSize: 'var(--ij-sidebar-shortcut-size)',
        lineHeight: '16px',
        fontFamily: 'var(--cp-font-human)',
        fontWeight: 500,
        opacity: hidden ? 0 : 1,
        transition: 'opacity var(--ij-motion) var(--ij-ease)',
      }}
    >
      {children}
    </h2>
  );
}

export function SidebarBlocksGroup({
  items,
  visuallyCollapsed,
  onAddBlock,
}: {
  readonly items: readonly BlockPaletteItem[];
  readonly visuallyCollapsed: boolean;
  readonly onAddBlock: (item: BlockPaletteItem) => void;
}) {
  return (
    <div
      data-rail-tier="blocks"
      aria-label="Blocks"
      className="flex flex-col"
      style={{ gap: 'var(--ij-sidebar-row-gap)' }}
    >
      <SidebarGroupLabel hidden={visuallyCollapsed}>Blocks</SidebarGroupLabel>
      {items.map((item) => {
        const Icon = BLOCK_ICONS[item.kind] ?? IconRecords;
        return (
          <button
            key={item.id}
            type="button"
            data-rail-tier="blocks"
            data-block-palette={item.id}
            title={item.label}
            aria-label={`Add ${item.label} block`}
            onClick={() => onAddBlock(item)}
            className="flex h-ij-nav-row w-full items-center rounded-ij-sidebar-row text-left hover:bg-ij-hover-surface"
            style={{
              paddingInline: 'var(--ij-sidebar-pad)',
              gap: 'var(--ij-sidebar-icon-gap)',
              color: 'var(--ij-ink)',
              fontWeight: 500,
              fontSize: 'var(--ij-sidebar-label-size)',
              lineHeight: 'var(--ij-sidebar-label-line)',
            }}
          >
            <SidebarRowIcon muted>
              <Icon size={16} />
            </SidebarRowIcon>
            <span
              className="min-w-0 flex-1 truncate"
              style={{
                opacity: visuallyCollapsed ? 0 : 1,
                transition: 'opacity var(--ij-motion) var(--ij-ease)',
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Sidebar({
  host,
  surfaces,
  activeSurfaceId,
  compact,
  landmarksRegion,
  activeGridRegionId,
  collapsed,
  onCollapsedChange,
  onAddBlock,
  objectTypes = [],
}: {
  readonly host: ConsoleBlockHost;
  readonly surfaces: readonly ObjectRef[];
  readonly companions: readonly SidebarRegion[];
  readonly activeSurfaceId: string;
  readonly compact: boolean;
  readonly landmarksRegion: SidebarRegion | null;
  readonly activeGridRegionId: string | null;
  readonly onToggleCompanion: (region: SidebarRegion) => void;
  readonly collapsed: boolean;
  readonly onCollapsedChange: (collapsed: boolean) => void;
  readonly onAddBlock?: (item: BlockPaletteItem) => void;
  readonly objectTypes?: readonly { readonly name: string; readonly count: number; readonly diverged?: boolean }[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const durations = useMotionDurations();
  const visuallyCollapsed = compact || collapsed;
  const domainLandmarks = useLandmarkObjects(host);
  const seededLandmarks = landmarksRegion?.instances ?? [];
  const landmarks = domainLandmarks.length > 0 ? domainLandmarks : seededLandmarks;
  const tenant = githubTenantSlug(session?.user?.githubLogin) ?? 'Local tenant';
  const viewerUserId = session?.user?.harnessIdentity
    ?? session?.user?.githubLogin
    ?? session?.user?.email
    ?? 'anonymous';
  const navigationObjects = useNavigationObjectItems(host, viewerUserId);
  const consoleDataInstalled = surfaces.some(
    (surface) => surface.id === CONSOLE_DATA_SURFACE_ID,
  );
  const blockPalette = deriveBlockPaletteItems(CONSOLE_VIEW_REGISTRY.descriptors)
    .filter(
      (item) =>
        item.descriptorId !== 'commonplace.console' || consoleDataInstalled,
    );
  const initials = (session?.user?.name ?? session?.user?.githubLogin ?? 'CP')
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const toggleCollapse = useCallback(() => {
    onCollapsedChange(!collapsed);
  }, [collapsed, onCollapsedChange]);

  useEffect(() => {
    for (const place of PLACE_ENTRIES) {
      router.prefetch(place.path);
    }
  }, [router]);

  const navigateTo = useCallback((surfaceId: string, path: string) => {
    // Routed Places let the pathname effect activate the surface. Flipping
    // layout state first can remount the shell before router.push commits.
    void softNavigate(router, path).catch(() => {
      void host.activateSurface(surfaceId);
    });
  }, [host, router]);

  const navigateToObjectType = useCallback(async (objectTypeId: string) => {
    const updated = await host.emit({
      kind: 'update',
      id: 'records.vi-table',
      patch: {
        query: {
          types: [objectTypeId],
          page: { limit: 100 },
          live: true,
        } as unknown as JsonValue,
      },
    });
    if (!updated.ok) return;
    navigateTo('console-records', `/records?type=${encodeURIComponent(objectTypeId)}`);
  }, [host, navigateTo]);

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
    for (const action of placeBlockAction(instanceId, {
      placement: 'ground',
      regionId: activeGridRegionId,
      order: 0,
    })) {
      const result = await host.emit(action);
      if (result.ok && result.value?.action_kind === 'move' && result.value.status === 'applied') {
        moves += 1;
      }
    }
    if (moves > 0) recordBlockMoveReceipts(moves);
  }, [activeGridRegionId, host]);

  const onLandmarkDragEnd = useCallback((event: DragEvent<HTMLDivElement>, landmark: ObjectRef) => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    void (async () => {
      const instanceId = await ensureLandmarkInstance(landmark);
      if (!instanceId) return;
      if (target?.closest('[data-block-arrangement], [data-ground-canvas], [data-region-kind="grid"], [data-region-kind="editor"]')) {
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

  const addBlock = useCallback((item: BlockPaletteItem) => {
    onAddBlock?.(item);
  }, [onAddBlock]);

  // Prefer CP3 navigation items; fall back to legacy objectTypes prop.
  const objectTypeRows = useMemo(() => {
    if (navigationObjects.length > 0) {
      return navigationObjects.map((item) => ({
        name: item.label,
        count: 0,
        key: item.id,
        objectTypeId: item.objectTypeId,
      }));
    }
    return objectTypes.map((type) => ({
      ...type,
      key: type.name,
      objectTypeId: type.name,
    }));
  }, [navigationObjects, objectTypes]);

  /* The five Places are the icon rail. Radio semantics, the keyboard
     shortcuts, and the data-* selectors the e2e specs assert ride along in
     buttonProps, so the published rail carries the console's contract without
     being forked. The label goes in as the accessible name and as sr-only text
     inside the button, which is what `radio ... toContainText` reads. */
  const railItems: readonly TwoLevelSidebarItem[] = PLACE_ENTRIES.map((place, index) => {
    const Icon = PLACE_ICONS[place.kind] ?? IconWorkspace;
    const active = place.surfaceId === activeSurfaceId;
    return {
      id: place.surfaceId,
      label: place.label,
      icon: <Icon size={16} />,
      buttonProps: {
        role: 'radio',
        'aria-checked': active,
        'aria-label': `${place.label} view`,
        'aria-keyshortcuts': `Control+${index + 1} Meta+${index + 1}`,
        title: `${place.label} (${shortcutLabel(index)})`,
        'data-rail-tier': 'place',
        'data-surface-nav': place.surfaceId,
        'data-selected': active ? 'true' : undefined,
        style: active ? SELECTION_STYLE : undefined,
      } as React.ButtonHTMLAttributes<HTMLButtonElement>,
    };
  });

  const activePlace = PLACE_ENTRIES.find((place) => place.surfaceId === activeSurfaceId);

  const panelBody = (
    <div
      className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto"
      style={{ gap: 'var(--ij-sidebar-zone-gap)' }}
    >
      {onAddBlock ? (
        <>
          <SidebarBlocksGroup
            items={blockPalette}
            visuallyCollapsed={false}
            onAddBlock={addBlock}
          />
          <SidebarDivider />
        </>
      ) : null}

      <div
        data-rail-tier="objects"
        aria-label="Objects"
        className="flex flex-col"
        style={{ gap: 'var(--ij-sidebar-row-gap)' }}
      >
        <SidebarGroupLabel>Objects</SidebarGroupLabel>
        {objectTypeRows.length === 0 ? (
          <p
            className="text-ij-ink-info"
            style={{
              paddingInline: 'var(--ij-sidebar-pad)',
              fontSize: 'var(--ij-sidebar-label-size)',
              fontFamily: 'var(--cp-font-human)',
            }}
          >
            No declared types yet.
          </p>
        ) : (
          objectTypeRows.map((type) => (
            <button
              key={type.key}
              type="button"
              data-rail-tier="objects"
              data-nav-item={type.key}
              onClick={() => void navigateToObjectType(type.objectTypeId)}
              className="flex h-ij-nav-row w-full items-center rounded-ij-sidebar-row text-left hover:bg-ij-hover-surface"
              style={{
                paddingInline: 'var(--ij-sidebar-pad)',
                gap: 'var(--ij-sidebar-icon-gap)',
                color: 'var(--ij-ink)',
                fontWeight: 500,
                fontSize: 'var(--ij-sidebar-label-size)',
              }}
            >
              <SidebarRowIcon muted>
                <IconRecords size={16} />
              </SidebarRowIcon>
              <span className="min-w-0 flex-1 truncate">
                {type.name}
                {'count' in type && type.count > 0 ? ` (${type.count})` : ''}
              </span>
            </button>
          ))
        )}
      </div>

      <SidebarDivider />

      <section
        aria-label="Pins"
        data-rail-tier="pin"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{ gap: '4px' }}
      >
        <SidebarGroupLabel>Pins</SidebarGroupLabel>
        <div className="flex flex-col" style={{ gap: 'var(--ij-sidebar-row-gap)' }}>
          {landmarks.map((landmark) => {
            const descriptorId = String(landmark.properties.descriptor_id ?? '');
            const descriptor = descriptorId
              ? CONSOLE_VIEW_REGISTRY.blocksForPlacement('rail').find((candidate) => candidate.id === descriptorId)
              : undefined;
            const glyph = descriptor?.block?.kindGlyph ?? String(landmark.properties.kind ?? 'records');
            const Icon = LANDMARK_ICONS[glyph] ?? IconRecords;
            const label = pinLabel(landmark, descriptor?.name ?? landmark.id);
            const removable = landmark.type === 'view-instance';
            return (
              <div
                key={landmark.id}
                draggable
                onDragEnd={(event) => onLandmarkDragEnd(event, landmark)}
                data-rail-tier="pin"
                data-sidebar-landmark={landmark.id}
                className="group relative flex h-ij-nav-row w-full items-center rounded-ij-sidebar-row hover:bg-ij-hover-surface"
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
                <SidebarRowIcon muted>
                  <Icon size={16} />
                </SidebarRowIcon>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {/* Overlaid, not laid out: at rest these two words cost the
                    label about 80px, which truncated pin names the panel is
                    otherwise wide enough to show. They only exist on hover, so
                    they should only take room on hover. */}
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 rounded-ij-sidebar-row bg-ij-hover-surface px-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
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
              </div>
            );
          })}
          {landmarks.length === 0 ? (
            <p
              className="text-ij-ink-info"
              style={{
                paddingInline: 'var(--ij-sidebar-pad)',
                fontSize: 'var(--ij-sidebar-label-size)',
                fontFamily: 'var(--cp-font-human)',
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
        }}
      >
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
        <span
          className="min-w-0 flex-1 truncate"
          style={{
            color: 'var(--ij-ink-info)',
            fontWeight: 500,
            fontSize: 'var(--ij-sidebar-label-size)',
            lineHeight: 'var(--ij-sidebar-label-line)',
            fontFamily: 'var(--cp-font-human)',
          }}
          title={tenant}
        >
          {tenant}
        </span>
      </div>
    </div>
  );

  /* Account stays on the rail, not in the panel: it has to survive a collapse,
     and signatures.spec asserts the trigger is visible at 28px. */
  const railFooter = (
    <>
      <button
        type="button"
        data-account-trigger
        aria-label="Account"
        aria-pressed={activeSurfaceId === ACCOUNT_SURFACE_ID}
        onClick={() => void host.activateSurface(ACCOUNT_SURFACE_ID)}
        className="flex size-ij-control shrink-0 items-center justify-center rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
        style={{
          transition: 'background-color var(--ij-motion) var(--ij-ease), color var(--ij-motion) var(--ij-ease)',
          ...(activeSurfaceId === ACCOUNT_SURFACE_ID ? SELECTION_STYLE : {}),
        }}
        title="Account"
      >
        <IconAccount size={14} />
      </button>
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
    </>
  );

  /* One sidebar system for the whole console: the same 21st rail plus detail
     panel the chat surface wears. The nav wrapper keeps the element the
     keyboard-collapse spec targets and the paint region the gates read; the
     rail and panel below it are the shared component. */
  return (
    <nav
      aria-label="Views, blocks, objects, and pins"
      data-paint-region="stripe"
      data-frame-resident="stripe"
      data-shell-region="rail"
      data-sidebar-collapsed={visuallyCollapsed}
      className="h-full w-full font-ij-ui"
      style={{
        transition: durations.reduced ? undefined : 'opacity var(--ij-motion) var(--ij-ease)',
      }}
    >
      <TwoLevelSidebarShell
        items={railItems}
        activeSection={activeSurfaceId}
        onSectionChange={(surfaceId) => {
          const place = PLACE_ENTRIES.find((entry) => entry.surfaceId === surfaceId);
          if (place) navigateTo(place.surfaceId, place.path);
        }}
        panelOpen={!visuallyCollapsed}
        onPanelOpenChange={(open) => onCollapsedChange(!open)}
        title={activePlace?.label ?? 'Views'}
        brand={<IconWorkspace size={20} />}
        panelBrand={
          <LayoutSwitcher
            host={host}
            surfaces={surfaces}
            activeSurfaceId={activeSurfaceId}
            showActiveName={false}
          />
        }
        footer={railFooter}
        railProps={{
          role: 'radiogroup',
          'aria-label': 'Views',
          ...{ 'data-surface-rail': '', 'data-rail-tier': 'place' },
        }}
        panel={panelBody}
      />
    </nav>
  );
}
