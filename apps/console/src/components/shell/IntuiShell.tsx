'use client';

// SOURCING: react-resizable-panels (split geometry, persisted sizes, 1px
// --ij-divider handles) per the ledger; the stripes, tool windows, and grid
// are the Int UI chrome contract (G3), hand-shaped because no library models
// the IntelliJ shell. The marriage requirement: the layout renders from the
// surface object; splitter drags and pane rearrangement write back through
// the host (moveSurfaceNodeAction semantics) and survive reload. Round 2
// (R3): surfaces are named screens; the shell renders whichever surface
// object carries the active flag, and every region (stripe affordance
// included) derives from that surface's own data, so a new screen is a seed,
// never a page component.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion } from 'motion/react';
import type { ObjectRef } from '@commonplace/block-view/types';
import { buildSurfaceTree, CONTAINS_EDGE, surfaceQuery, type SurfaceTreeNode } from '@commonplace/block-view/surface-tree';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { SURFACE_ID } from '@/lib/workspace-seed';
import { pathForSurfaceKind, surfaceIdForPath } from '@/lib/surface-routes';
import { useShellStore } from '@/lib/shell-store';
import { seconds, staggerDelay, useMotionDurations, EASE_OUT, DUR } from '@/motion/motion-tokens';
import { ViewInstanceHost } from './ViewInstanceHost';
import { EditorTabs } from './EditorTabs';
import { BlockArrangementHost } from '@/components/blocks/BlockArrangementHost';
import { MainToolbar } from './MainToolbar';
import { SearchPanel } from './SearchField';
import { ActionSheet } from './ActionSheet';
import { StatusBar } from './StatusBar';
import { RecordInspector } from '@/views/RecordInspector';
import { Sidebar, type SidebarRegion } from './Sidebar';

const OVERLAY_BREAKPOINT = 1100;

type RegionNode = SidebarRegion;

interface SurfaceRegions {
  readonly left: readonly RegionNode[];
  readonly right: readonly RegionNode[];
  readonly editor: RegionNode | null;
}

function regionsOf(root: SurfaceTreeNode | null): SurfaceRegions {
  const left: RegionNode[] = [];
  const right: RegionNode[] = [];
  let editor: RegionNode | null = null;
  for (const child of root?.children ?? []) {
    const node: RegionNode = {
      object: child.object,
      instances: child.children.map((candidate) => candidate.object),
    };
    if (child.object.properties.kind === 'editor' || child.object.properties.kind === 'grid') {
      editor = node;
    } else if (child.object.properties.side === 'right') right.push(node);
    else left.push(node);
  }
  return { left, right, editor };
}

function isOpen(region: RegionNode): boolean {
  return region.object.properties.open !== false;
}

/** The Int UI tool window slot. Block chrome lives on BlockShell inside
 *  ViewInstanceHost; this wrapper is layout only and must not paint or
 *  register as a block. */
function ToolWindow({
  region,
  host,
  entranceIndex,
  onHide,
  gridRegionId,
}: {
  region: RegionNode;
  host: ConsoleBlockHost;
  entranceIndex: number;
  onHide: () => void;
  /** Grid editor region id for stripe-tray demotion back onto the canvas. */
  gridRegionId?: string | null;
}) {
  const durations = useMotionDurations();
  const title = String(region.object.properties.title ?? region.object.id);
  const isStripeTray = region.object.properties.kind === 'stripe-tray';
  return (
    <motion.section
      initial={durations.reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: seconds(durations.base),
        delay: seconds(staggerDelay(entranceIndex)),
        ease: EASE_OUT,
      }}
      aria-label={`${title} tool window`}
      data-tool-window={String(region.object.properties.companion ?? region.object.id)}
      data-paint-region="tool-window"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent"
    >
      <div className="min-h-0 flex-1">
        {region.instances.map((instance) => (
          <ViewInstanceHost
            key={instance.id}
            instance={instance}
            host={host}
            forceShell
            onHide={onHide}
            returnToGridRegionId={isStripeTray ? (gridRegionId ?? undefined) : undefined}
          />
        ))}
      </div>
    </motion.section>
  );
}

/** The arrangement as an external store: the host's live ObjectSet is the
 *  source of truth and React subscribes to it (no setState-in-effect). */
function createLayoutStore(host: ConsoleBlockHost) {
  const set = host.queryLayout(surfaceQuery());
  let current: readonly ObjectRef[] = set.objects;
  return {
    subscribe: (onStoreChange: () => void) =>
      set.subscribe((next) => {
        current = next.objects;
        onStoreChange();
      }),
    getSnapshot: () => current,
  };
}

export function IntuiShell({ host }: { host: ConsoleBlockHost }) {
  const durations = useMotionDurations();
  const [compact, setCompact] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const selectedRecordId = useShellStore((state) => state.selectedRecordId);

  // The arrangement is live data: query the surface object and subscribe.
  const layoutStore = useMemo(() => createLayoutStore(host), [host]);
  const layoutObjects = useSyncExternalStore(
    layoutStore.subscribe,
    layoutStore.getSnapshot,
    layoutStore.getSnapshot,
  );
  const surfaces = useMemo(
    () => (layoutObjects ?? []).filter((object) => object.type === 'surface'),
    [layoutObjects],
  );
  const primarySurfaces = useMemo(
    () => surfaces
      .filter((surface) => pathForSurfaceKind(String(surface.properties.kind ?? '')) !== null)
      .sort((a, b) => Number(a.properties.stripe_order) - Number(b.properties.stripe_order)),
    [surfaces],
  );

  const pathname = usePathname();
  const router = useRouter();

  // Constrained width: tool windows become overlays while stripes remain.
  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setCompact(width > 0 && width < OVERLAY_BREAKPOINT);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The active surface: the one carrying the active flag, the proof
  // workspace otherwise. Switching layouts flips flags on surface objects;
  // regions and their arrangement stay untouched per surface (R3.3).
  const activeSurfaceId = useMemo(() => {
    return surfaces.find((object) => object.properties.active === true)?.id ?? SURFACE_ID;
  }, [surfaces]);

  // Deep links and back/forward: the route is the surface radio (B3).
  useEffect(() => {
    const routedId = surfaceIdForPath(pathname);
    if (!routedId || routedId === activeSurfaceId) return;
    void host.activateSurface(routedId);
  }, [activeSurfaceId, host, pathname]);

  const root = useMemo(
    () => (layoutObjects ? buildSurfaceTree(activeSurfaceId, layoutObjects) : null),
    [layoutObjects, activeSurfaceId],
  );
  const regions = useMemo(() => regionsOf(root), [root]);
  const editor = regions.editor;
  const companions = useMemo(() => {
    const order = new Map([['files', 0], ['context', 1], ['thread', 2]]);
    return [...regions.left, ...regions.right]
      .filter((region) => region.object.properties.role === 'companion')
      .sort((a, b) =>
        (order.get(String(a.object.properties.companion)) ?? 99) -
        (order.get(String(b.object.properties.companion)) ?? 99));
  }, [regions]);

  const toggle = useCallback(
    (region: RegionNode) => {
      const open = region.object.properties.open === false;
      const side = regions.left.includes(region) ? regions.left : regions.right;
      const exclusivePeers = compact && open
        ? side.filter((candidate) => candidate !== region).map((candidate) => candidate.object.id)
        : [];
      void host.setRegionOpen(region.object.id, open, exclusivePeers);
    },
    [compact, host, regions.left, regions.right],
  );

  // Alt+1..5 supplements Cmd/Ctrl surface switching on the five routed
  // surfaces. Alt+Shift+1..3 toggles companions for the active surface.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.shiftKey) {
        companions.forEach((region, index) => {
          if (event.key === String(index + 1)) {
            event.preventDefault();
            toggle(region);
          }
        });
        return;
      }
      primarySurfaces.forEach((surface, index) => {
        if (event.key === String(index + 1)) {
          event.preventDefault();
          const kind = String(surface.properties.kind ?? '');
          const path = pathForSurfaceKind(kind);
          void host.activateSurface(surface.id);
          if (path) router.push(path);
        }
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [companions, host, primarySurfaces, router, toggle]);

  useEffect(() => {
    const focusComposer = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'l') return;
      const inputs = [...document.querySelectorAll<HTMLTextAreaElement>('[data-composer-input]')];
      const visible = inputs.find((input) => input.offsetParent !== null && !input.disabled);
      if (!visible) return;
      event.preventDefault();
      visible.focus();
    };
    window.addEventListener('keydown', focusComposer);
    return () => window.removeEventListener('keydown', focusComposer);
  }, []);

  // Persisted sizes are absolute shares of the full well (they sum to 100
  // across ALL of the active surface's regions, open or closed). Rendering
  // renormalizes over the visible set and write-back scales visible-relative
  // drag sizes back to absolute shares; without this, closing a tool window
  // and dragging leaves totals like 124 percent and the panel library
  // silently discards the arrangement on reopen.
  const absOf = useCallback((region: RegionNode | null, fallback: number) => {
    const value = region?.object.properties.size;
    return typeof value === 'number' ? value : fallback;
  }, []);

  const visiblePanels = useMemo(() => {
    const panels: { region: RegionNode; abs: number }[] = [];
    for (const region of regions.left.filter(isOpen)) panels.push({ region, abs: absOf(region, 24) });
    if (regions.editor) panels.push({ region: regions.editor, abs: absOf(regions.editor, 48) });
    for (const region of regions.right.filter(isOpen)) panels.push({ region, abs: absOf(region, 28) });
    return panels;
  }, [regions, absOf]);

  const visibleTotal = visiblePanels.reduce((sum, panel) => sum + panel.abs, 0) || 100;
  const leftOpen = regions.left.filter(isOpen);
  const rightOpen = regions.right.filter(isOpen);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLayout = useCallback(
    (sizes: number[]) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      const snapshot = visiblePanels.map((panel) => panel.region.object.id);
      const total = visibleTotal;
      persistTimer.current = setTimeout(() => {
        snapshot.forEach((regionId, index) => {
          const size = sizes[index];
          if (typeof size === 'number') {
            void host.emit({ kind: 'update', id: regionId, patch: { size: (size * total) / 100 } });
          }
        });
      }, 250);
    },
    [host, visiblePanels, visibleTotal],
  );
  const stripeTrayId =
    [...regions.left, ...regions.right].find(
      (region) => region.object.properties.kind === 'stripe-tray',
    )?.object.id ?? null;
  // Stripe-tray is the rail target only; exclude it from dock zones so the
  // same region is not dual-labeled as both "Move to rail" and "Dock as tool".
  const dockRegionIds = useMemo(
    () =>
      [...regions.left, ...regions.right]
        .filter((region) => region.object.id !== stripeTrayId)
        .map((region) => region.object.id),
    [regions.left, regions.right, stripeTrayId],
  );
  const landmarkRegion = useMemo(() => {
    const object = layoutObjects?.find(
      (candidate) => candidate.type === 'region' && candidate.properties.kind === 'landmarks',
    );
    if (!object) return null;
    const children = object.relations?.[CONTAINS_EDGE] ?? [];
    const instances = children
      .map((id) => layoutObjects?.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is ObjectRef => candidate?.type === 'view-instance');
    return { object, instances };
  }, [layoutObjects]);

  if (!root || !editor) {
    return <div className="h-full w-full bg-ij-frame" aria-busy="true" />;
  }

  const editorPane = (
    <motion.div
      initial={durations.reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        // Editor content fades in after the chrome settles: chrome entrances
        // take DUR.base, so the fade starts at DUR.slow - DUR.base and the
        // whole entrance completes inside the DUR.slow budget.
        duration: seconds(durations.base),
        delay: seconds(durations.reduced ? 0 : DUR.slow - DUR.base),
        ease: EASE_OUT,
      }}
      className="h-full min-h-0"
    >
      {editor.object.properties.kind === 'grid' ? (
        <BlockArrangementHost
          region={editor.object}
          instances={editor.instances}
          host={host}
          dockRegionIds={dockRegionIds}
          railRegionId={stripeTrayId}
          fullRegionId={editor.object.id}
        />
      ) : (
        <EditorTabs region={editor.object} instances={editor.instances} host={host} />
      )}
    </motion.div>
  );

  // The PanelGroup remounts ONLY when the active surface changes (a real
  // screen switch), never when a tool window toggles. Keying on the visible
  // panel set instead tore the whole well down and rebuilt it on every
  // open/close, which read as a black frame drop (the editor and thread
  // unmounted, and the editor's delayed entrance fade re-fired) rather than
  // a smooth reflow. react-resizable-panels reconciles a panel appearing or
  // disappearing in place, given each panel a stable id and order.
  const groupKey = activeSurfaceId;

  // Stable panel order from the full region lists (open or closed), so adding
  // or removing a visible panel never renumbers the others: left windows
  // first, then the editor, then right windows.
  const orderOf = (region: RegionNode): number => {
    const leftIndex = regions.left.indexOf(region);
    if (leftIndex >= 0) return leftIndex + 1;
    if (region === regions.editor) return regions.left.length + 1;
    const rightIndex = regions.right.indexOf(region);
    if (rightIndex >= 0) return regions.left.length + 2 + rightIndex;
    return 999;
  };

  return (
    <div
      ref={shellRef}
      data-shell
      data-compact={compact}
      data-active-surface={activeSurfaceId}
      className="relative flex h-full min-h-0 flex-col bg-transparent"
    >
      <MainToolbar host={host} surfaces={surfaces} activeSurfaceId={activeSurfaceId} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          host={host}
          surfaces={primarySurfaces}
          companions={companions}
          activeSurfaceId={activeSurfaceId}
          compact={compact}
          landmarksRegion={landmarkRegion}
          activeGridRegionId={editor.object.properties.kind === 'grid' ? editor.object.id : null}
          onToggleCompanion={toggle}
        />

        <div
          data-shell-region="ground"
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-ij-island-gutter p-ij-island-gutter"
        >
          <div className="relative min-h-0 min-w-0 flex-1">
            {compact ? (
              <>
                {editorPane}
                {leftOpen[0] ? (
                  <div data-shell-region="dock" data-dock-edge="left" className="absolute inset-y-0 left-0 z-30 w-80">
                    <ToolWindow
                      region={leftOpen[0]}
                      host={host}
                      entranceIndex={0}
                      onHide={() => toggle(leftOpen[0])}
                      gridRegionId={editor.object.id}
                    />
                  </div>
                ) : null}
                {rightOpen[0] ? (
                  <div data-shell-region="dock" data-dock-edge="right" className="absolute inset-y-0 right-0 z-30 w-96">
                    <ToolWindow
                      region={rightOpen[0]}
                      host={host}
                      entranceIndex={1}
                      onHide={() => toggle(rightOpen[0])}
                      gridRegionId={editor.object.id}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <PanelGroup key={groupKey} direction="horizontal" onLayout={onLayout}>
                {visiblePanels.flatMap((panel, index) => {
                  const isEditor = panel.region === editor;
                  const nodes = [];
                  if (index > 0) {
                    nodes.push(
                      <PanelResizeHandle
                        key={`handle-${panel.region.object.id}`}
                        data-panel-seam
                        className="relative w-ij-island-gutter bg-transparent"
                      />,
                    );
                  }
                  nodes.push(
                    <Panel
                      key={panel.region.object.id}
                      id={panel.region.object.id}
                      order={orderOf(panel.region)}
                      defaultSize={(panel.abs / visibleTotal) * 100}
                      minSize={isEditor ? 30 : 12}
                    >
                      {isEditor ? (
                        editorPane
                      ) : (
                        <div
                          data-shell-region="dock"
                          data-dock-edge={panel.region.object.properties.side === 'right' ? 'right' : 'left'}
                          className="h-full min-h-0"
                        >
                          <ToolWindow
                            region={panel.region}
                            host={host}
                            entranceIndex={panel.region.object.properties.side === 'right' ? 1 : 0}
                            onHide={() => toggle(panel.region)}
                            gridRegionId={editor.object.id}
                          />
                        </div>
                      )}
                    </Panel>,
                  );
                  return nodes;
                })}
              </PanelGroup>
            )}
            {selectedRecordId ? (
              <div className="absolute inset-y-0 right-0 z-40">
                <RecordInspector host={host} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <StatusBar host={host} />
      <SearchPanel host={host} />
      <ActionSheet host={host} />
    </div>
  );
}
