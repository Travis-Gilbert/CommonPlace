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
import { useThreadStore } from '@/lib/thread-store';
import { PresenceMark } from '@/components/mark/PresenceMark';
import { seconds, staggerDelay, useMotionDurations, EASE_OUT, DUR } from '@/motion/motion-tokens';
import { ViewInstanceHost } from './ViewInstanceHost';
import { EditorTabs } from './EditorTabs';
import { MainToolbar } from './MainToolbar';
import { StatusBar } from './StatusBar';
import { OmnibarIsland } from './Omnibar';
import { RecordInspector } from '@/views/RecordInspector';
import { IconDoc, IconRail, IconRecords, IconThread } from './icons';

const OVERLAY_BREAKPOINT = 1100;

/** Region icon slugs carried on the surface object; the glyphs stay in the
 *  one chrome icon file. */
const REGION_ICONS: Record<string, typeof IconRecords> = {
  records: IconRecords,
  thread: IconThread,
  rail: IconRail,
  docs: IconDoc,
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

/** Stripe shortcuts derive from side order: left windows Alt+1..4, right
 *  windows Alt+9..6 (the JetBrains convention). */
function shortcutFor(side: 'left' | 'right', index: number): string {
  return side === 'left' ? String(index + 1) : String(9 - index);
}

function isOpen(region: RegionNode): boolean {
  return region.object.properties.open !== false;
}

function StripeButton({
  region,
  side,
  index,
  entranceIndex,
  onToggle,
}: {
  region: RegionNode;
  side: 'left' | 'right';
  index: number;
  entranceIndex: number;
  onToggle: () => void;
}) {
  const durations = useMotionDurations();
  const title = String(region.object.properties.title ?? region.object.id);
  const Icon = REGION_ICONS[String(region.object.properties.icon ?? '')] ?? IconRecords;
  const key = shortcutFor(side, index);
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
      title={`${title} (Alt+${key})`}
      aria-label={`${title} tool window`}
      aria-pressed={open}
      aria-keyshortcuts={`Alt+${key}`}
      onClick={onToggle}
      className="flex h-10 w-10 items-center justify-center rounded-ij-arc"
      style={{
        color: open ? 'var(--ij-ink-bright)' : 'var(--ij-ink-info)',
        background: open ? 'var(--ij-accent)' : 'transparent',
        transition: 'var(--rec-clickable-transition)',
      }}
    >
      <Icon size={16} />
    </motion.button>
  );
}

/** The thread header carries the mark (R4.2: header and composer line are the
 *  mark's only placements); state binds to the one ambient runtime. */
function HeaderMark() {
  const isRunning = useThreadStore((state) => state.isRunning);
  return (
    <span className="ml-auto flex items-center">
      <PresenceMark state={isRunning ? 'composing' : 'idle'} size={20} />
    </span>
  );
}

function ToolWindow({
  region,
  host,
  entranceIndex,
}: {
  region: RegionNode;
  host: ConsoleBlockHost;
  entranceIndex: number;
}) {
  const durations = useMotionDurations();
  const title = String(region.object.properties.title ?? region.object.id);
  const withMark = region.object.properties.mark === true;
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
      className="flex h-full min-h-0 flex-col bg-ij-chrome"
    >
      <div className="flex h-ij-toolbar shrink-0 items-center border-b border-ij-seam px-3 text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
        {title}
        {withMark ? <HeaderMark /> : null}
      </div>
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
    const surfaces = (layoutObjects ?? []).filter((object) => object.type === 'surface');
    return surfaces.find((object) => object.properties.active === true)?.id ?? SURFACE_ID;
  }, [layoutObjects]);

  const root = useMemo(
    () => (layoutObjects ? buildSurfaceTree(activeSurfaceId, layoutObjects) : null),
    [layoutObjects, activeSurfaceId],
  );
  const regions = useMemo(() => regionsOf(root), [root]);
  const editor = regions.editor;

  const toggle = useCallback(
    (region: RegionNode) => {
      void host.emit({
        kind: 'update',
        id: region.object.id,
        patch: { open: region.object.properties.open === false },
      });
    },
    [host],
  );

  // Keyboard shortcuts toggle every tool window on the active surface.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      regions.left.forEach((region, index) => {
        if (event.key === shortcutFor('left', index)) {
          event.preventDefault();
          toggle(region);
        }
      });
      regions.right.forEach((region, index) => {
        if (event.key === shortcutFor('right', index)) {
          event.preventDefault();
          toggle(region);
        }
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [regions, toggle]);

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

  const groupKey = `${activeSurfaceId}:${visiblePanels.map((panel) => panel.region.object.id).join('+')}`;

  return (
    <div ref={shellRef} data-shell data-active-surface={activeSurfaceId} className="relative flex h-full min-h-0 flex-col bg-ij-frame">
      <MainToolbar host={host} surfaces={(layoutObjects ?? []).filter((object) => object.type === 'surface')} activeSurfaceId={activeSurfaceId} />
      <div className="flex min-h-0 flex-1">
        {/* Left stripe */}
        <nav aria-label="Left tool window stripe" className="flex w-ij-stripe shrink-0 flex-col items-center gap-1 border-r border-ij-seam bg-ij-chrome py-1">
          {regions.left.map((region, index) => (
            <StripeButton
              key={region.object.id}
              region={region}
              side="left"
              index={index}
              entranceIndex={index}
              onToggle={() => toggle(region)}
            />
          ))}
        </nav>

        <div className="relative min-h-0 min-w-0 flex-1">
          {compact ? (
            <>
              {editorPane}
              {leftOpen[0] ? (
                <div className="absolute inset-y-0 left-0 z-30 w-80 border-r border-ij-seam shadow-none">
                  <ToolWindow region={leftOpen[0]} host={host} entranceIndex={0} />
                </div>
              ) : null}
              {rightOpen[0] ? (
                <div className="absolute inset-y-0 right-0 z-30 w-96 border-l border-ij-seam">
                  <ToolWindow region={rightOpen[0]} host={host} entranceIndex={1} />
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
                      className="w-px bg-ij-divider data-[resize-handle-state=drag]:bg-ij-accent"
                    />,
                  );
                }
                nodes.push(
                  <Panel
                    key={panel.region.object.id}
                    id={panel.region.object.id}
                    order={index + 1}
                    defaultSize={(panel.abs / visibleTotal) * 100}
                    minSize={isEditor ? 30 : 14}
                  >
                    {isEditor ? (
                      editorPane
                    ) : (
                      <ToolWindow
                        region={panel.region}
                        host={host}
                        entranceIndex={panel.region.object.properties.side === 'right' ? 1 : 0}
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
        </div>

        {/* Right stripe */}
        <nav aria-label="Right tool window stripe" className="flex w-ij-stripe shrink-0 flex-col items-center gap-1 border-l border-ij-seam bg-ij-chrome py-1">
          {regions.right.map((region, index) => (
            <StripeButton
              key={region.object.id}
              region={region}
              side="right"
              index={index}
              entranceIndex={index + 1}
              onToggle={() => toggle(region)}
            />
          ))}
        </nav>
      </div>
      <StatusBar host={host} />
      <OmnibarIsland host={host} />
    </div>
  );
}
