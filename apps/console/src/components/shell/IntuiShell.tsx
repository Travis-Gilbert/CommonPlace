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
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion } from 'motion/react';
import type { ObjectRef } from '@commonplace/block-view/types';
import { buildSurfaceTree, surfaceQuery, type SurfaceTreeNode } from '@commonplace/block-view/surface-tree';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { SURFACE_ID } from '@/lib/workspace-seed';
import { useShellStore } from '@/lib/shell-store';
import { seconds, staggerDelay, useMotionDurations, EASE_OUT, DUR } from '@/motion/motion-tokens';
import { ViewInstanceHost } from './ViewInstanceHost';
import { EditorTabs } from './EditorTabs';
import { MainToolbar } from './MainToolbar';
import { StatusBar } from './StatusBar';
import { SearchPanel } from './SearchField';
import { ActionSheet } from './ActionSheet';
import { RecordInspector } from '@/views/RecordInspector';
import { HostPresenceCursor } from '@/components/host/HostPresenceCursor';
import { HostPresenceSync } from '@/components/host/HostPresenceSync';
import { HostFindLens } from '@/components/host/HostFindLens';
import { HostCapabilityRailBridge } from '@/components/host/HostCapabilityRailBridge';
import {
  IconCards,
  IconDoc,
  IconHide,
  IconInspector,
  IconMemory,
  IconModel,
  IconRail,
  IconRecords,
  IconThread,
  IconWorkspace,
} from './icons';

const OVERLAY_BREAKPOINT = 1100;

/** Stripe glyph size (X3.4). The register carries this as --ij-stripe-icon;
 *  the icon components take a numeric SVG size, so the one place the number is
 *  restated is here, next to the token it mirrors. */
const STRIPE_ICON = 20;

/** Surface nav icons by surface kind: the stripe surfaces group (AMENDMENT:
 *  surfaces join the layout switcher AND the stripe surfaces group). */
const SURFACE_ICONS: Record<string, typeof IconRecords> = {
  chat: IconThread,
  workspace: IconWorkspace,
  index: IconRail,
  documents: IconDoc,
  cards: IconCards,
  proactivity: IconRail,
  model: IconModel,
  review: IconInspector,
  goals: IconModel,
};

/** Region icon slugs carried on the surface object; the glyphs stay in the
 *  one chrome icon file. */
const REGION_ICONS: Record<string, typeof IconRecords> = {
  records: IconRecords,
  thread: IconThread,
  rail: IconRail,
  docs: IconDoc,
  files: IconDoc,
  context: IconMemory,
};

interface RegionNode {
  readonly object: ObjectRef;
  readonly instances: readonly ObjectRef[];
}

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
    if (child.object.properties.kind === 'editor') editor = node;
    else if (child.object.properties.side === 'right') right.push(node);
    else left.push(node);
  }
  return { left, right, editor };
}

function isOpen(region: RegionNode): boolean {
  return region.object.properties.open !== false;
}

/** The stripe button grammar (X3.4 / named choice 5). Int UI stripe buttons are
 *  monochrome icons on the ink ladder at rest and take a WEAK FILL when
 *  selected, with the glyph rising to full ink; they are never saturated accent
 *  tiles with inverted glyphs, which is what the console had drifted into and
 *  what made the stripe read as a row of colored chips rather than chrome.
 *  Domain tint stays a content affordance per the icon policy, so no stripe
 *  glyph carries a domain color at rest. */
const STRIPE_BUTTON_CLASS =
  'flex h-10 w-10 items-center justify-center rounded-ij-arc hover:bg-ij-hover-surface';

function stripeButtonStyle(selected: boolean) {
  return {
    color: selected ? 'var(--ij-ink)' : 'var(--ij-ink-info)',
    background: selected ? 'var(--ij-selection)' : 'transparent',
    transition: 'var(--rec-clickable-transition)',
  } as const;
}

function CompanionButton({
  region,
  index,
  entranceIndex,
  onToggle,
}: {
  region: RegionNode;
  index: number;
  entranceIndex: number;
  onToggle: () => void;
}) {
  const durations = useMotionDurations();
  const title = String(region.object.properties.title ?? region.object.id);
  const Icon = REGION_ICONS[String(region.object.properties.icon ?? '')] ?? IconRecords;
  const key = String(index + 1);
  const open = isOpen(region);
  return (
    <motion.button
      initial={durations.reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: seconds(durations.base),
        delay: seconds(staggerDelay(entranceIndex)),
        ease: EASE_OUT,
      }}
      type="button"
      data-companion-nav={String(region.object.properties.companion ?? '')}
      title={`${title} (Alt+Shift+${key})`}
      aria-label={`${title} companion`}
      aria-pressed={open}
      aria-keyshortcuts={`Alt+Shift+${key}`}
      onClick={onToggle}
      className={STRIPE_BUTTON_CLASS}
      style={stripeButtonStyle(open)}
    >
      <Icon size={STRIPE_ICON} />
    </motion.button>
  );
}

/** The stripe surfaces group: the top group of the leftmost stripe lists every
 *  seeded surface and switches screens by flipping the active flag through the
 *  host. This is the primary navigation (the AMENDMENT's stripe surfaces
 *  group); it shares the leftmost bar with the active surface's tool windows,
 *  divided, in the JetBrains grouped-stripe manner. */
function SurfaceNavGroup({
  surfaces,
  activeSurfaceId,
  host,
}: {
  surfaces: readonly ObjectRef[];
  activeSurfaceId: string;
  host: ConsoleBlockHost;
}) {
  const durations = useMotionDurations();
  if (surfaces.length === 0) return null;
  const switchTo = async (surfaceId: string) => {
    if (surfaceId === activeSurfaceId) return;
    await host.activateSurface(surfaceId);
  };
  return (
    <div data-surface-rail role="radiogroup" aria-label="Surfaces" className="flex flex-col items-center gap-1">
      {surfaces.map((surface, index) => {
        const kind = String(surface.properties.kind ?? '');
        const name = String(surface.properties.name ?? surface.id);
        const Icon = SURFACE_ICONS[kind] ?? IconWorkspace;
        const active = surface.id === activeSurfaceId;
        return (
          <motion.button
            key={surface.id}
            initial={durations.reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: seconds(durations.base),
              delay: seconds(staggerDelay(index)),
              ease: EASE_OUT,
            }}
            type="button"
            role="radio"
            data-surface-nav={surface.id}
            title={name}
            aria-label={`${name} surface`}
            aria-checked={active}
            aria-keyshortcuts={`Alt+${index + 1}`}
            onClick={() => void switchTo(surface.id)}
            className={STRIPE_BUTTON_CLASS}
            style={stripeButtonStyle(active)}
          >
            <Icon size={STRIPE_ICON} />
          </motion.button>
        );
      })}
    </div>
  );
}

/** The Int UI tool window header strip (X3.2). A 24px band on chrome carrying
 *  the title in ink at the register's 13px, a bottom seam, and a right-aligned
 *  action slot holding the hide affordance. Files, Context and Thread stop
 *  being floating labels: the strip is what names a tool window and bounds it,
 *  which is also what gives an EMPTY companion a frame to be empty inside
 *  (X5.2). The 40px main-toolbar height it replaces belonged to the toolbar. */
function ToolWindowHeader({ title, onHide }: { title: string; onHide: () => void }) {
  return (
    <div
      data-tool-window-header
      data-paint-region="tool-window-header"
      className="flex h-ij-toolwindow-header shrink-0 items-center gap-2 border-b border-ij-seam bg-ij-chrome px-2 text-ij-ink"
      style={{ fontWeight: 'var(--rec-weight-cap)' }}
    >
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <button
        type="button"
        data-tool-window-hide
        aria-label={`Hide ${title}`}
        title={`Hide ${title}`}
        onClick={onHide}
        className="flex size-5 shrink-0 items-center justify-center rounded-ij-arc-underline text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
        style={{ transition: 'var(--rec-clickable-transition)' }}
      >
        <IconHide size={14} />
      </button>
    </div>
  );
}

function ToolWindow({
  region,
  host,
  entranceIndex,
  onHide,
}: {
  region: RegionNode;
  host: ConsoleBlockHost;
  entranceIndex: number;
  onHide: () => void;
}) {
  const durations = useMotionDurations();
  const title = String(region.object.properties.title ?? region.object.id);
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
      className="flex h-full min-h-0 flex-col bg-ij-chrome"
    >
      <ToolWindowHeader title={title} onHide={onHide} />
      <div className="min-h-0 flex-1">
        {region.instances.map((instance) => (
          <ViewInstanceHost key={instance.id} instance={instance} host={host} />
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
      .filter((surface) => typeof surface.properties.stripe_order === 'number')
      .sort((a, b) => Number(a.properties.stripe_order) - Number(b.properties.stripe_order)),
    [surfaces],
  );

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

  // Alt+1..6 switches the primary surface radio group. Alt+Shift+1..3
  // toggles the companion group for the active surface.
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
          void host.activateSurface(surface.id);
        }
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [companions, host, primarySurfaces, toggle]);

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
      <EditorTabs region={editor.object} instances={editor.instances} host={host} />
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
    <div ref={shellRef} data-shell data-compact={compact} data-active-surface={activeSurfaceId} className="relative flex h-full min-h-0 flex-col bg-ij-frame">
      <MainToolbar host={host} surfaces={surfaces} activeSurfaceId={activeSurfaceId} />
      <div className="flex min-h-0 flex-1">
        {/* The leftmost stripe: screen navigation (surfaces group) on top,
            then the active surface's tool windows, divided. One bar. */}
        <nav aria-label="Surfaces and companions" data-paint-region="stripe" className="flex w-ij-stripe shrink-0 flex-col items-center gap-1 border-r border-ij-seam bg-ij-chrome py-1">
          <SurfaceNavGroup
            surfaces={primarySurfaces}
            activeSurfaceId={activeSurfaceId}
            host={host}
          />
          {companions.length > 0 ? (
            <div aria-hidden className="my-1 h-px w-6 shrink-0 bg-ij-seam" />
          ) : null}
          <div aria-label="Companions" className="flex flex-col items-center gap-1">
          {companions.map((region, index) => (
            <CompanionButton
              key={region.object.id}
              region={region}
              index={index}
              entranceIndex={index}
              onToggle={() => toggle(region)}
            />
          ))}
          </div>
        </nav>

        <div className="relative min-h-0 min-w-0 flex-1">
          {compact ? (
            <>
              {editorPane}
              {leftOpen[0] ? (
                <div className="absolute inset-y-0 left-0 z-30 w-80 border-r border-ij-seam shadow-none">
                  <ToolWindow
                    region={leftOpen[0]}
                    host={host}
                    entranceIndex={0}
                    onHide={() => toggle(leftOpen[0])}
                  />
                </div>
              ) : null}
              {rightOpen[0] ? (
                <div className="absolute inset-y-0 right-0 z-30 w-96 border-l border-ij-seam">
                  <ToolWindow
                    region={rightOpen[0]}
                    host={host}
                    entranceIndex={1}
                    onHide={() => toggle(rightOpen[0])}
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
                    // The companion-to-editor junction (X3.1). This was
                    // --ij-divider, which resolves to gray-3 in dark: LIGHTER
                    // than the gray-2 chrome it separates, so the one seam
                    // between a tool window and the editor ran the Int UI
                    // inversion backwards. --ij-seam is gray-1 in dark and
                    // gray-12 in light, darker than chrome in both, which is
                    // what the inversion assertion checks.
                    <PanelResizeHandle
                      key={`handle-${panel.region.object.id}`}
                      data-panel-seam
                      className="w-px bg-ij-seam data-[resize-handle-state=drag]:bg-ij-accent"
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
                      <ToolWindow
                        region={panel.region}
                        host={host}
                        entranceIndex={panel.region.object.properties.side === 'right' ? 1 : 0}
                        onHide={() => toggle(panel.region)}
                      />
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
          <HostPresenceSync workspaceId="default" surface="commonplace" />
          <HostPresenceCursor workspaceId="default" surface="commonplace" />
          <HostFindLens workspaceId="default" surface="commonplace" />
          <HostCapabilityRailBridge workspaceId="default" />
        </div>
      </div>
      <StatusBar host={host} />
      <SearchPanel host={host} />
      <ActionSheet host={host} />
    </div>
  );
}
