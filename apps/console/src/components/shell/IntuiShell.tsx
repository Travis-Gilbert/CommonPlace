'use client';

// SOURCING: react-resizable-panels (split geometry, persisted sizes, 1px
// --ij-divider handles) per the ledger; the stripes, tool windows, and grid
// are the Int UI chrome contract (G3), hand-shaped because no library models
// the IntelliJ shell. The marriage requirement: the layout renders from the
// surface object; splitter drags and pane rearrangement write back through
// the host (moveSurfaceNodeAction semantics) and survive reload.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion } from 'motion/react';
import type { ObjectRef } from '@commonplace/block-view/types';
import { buildSurfaceTree, surfaceQuery, type SurfaceTreeNode } from '@commonplace/block-view/surface-tree';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { SURFACE_ID } from '@/lib/workspace-seed';
import { useShellStore } from '@/lib/shell-store';
import { seconds, staggerDelay, useMotionDurations, EASE_OUT, DUR } from '@/motion/motion-tokens';
import { registerToolWindow, toolWindowsFor, type ToolWindowRegistration } from './tool-windows';
import { ViewInstanceHost } from './ViewInstanceHost';
import { EditorTabs } from './EditorTabs';
import { MainToolbar } from './MainToolbar';
import { StatusBar } from './StatusBar';
import { SearchEverywhere } from './SearchEverywhere';
import { RecordInspector } from '@/views/RecordInspector';
import { IconRecords, IconThread } from './icons';

// Chrome-level registrations: icon, side, shortcut per region id. Content
// still resolves from the region's view instances by descriptor.
registerToolWindow({ id: 'region-left', title: 'Records', icon: IconRecords, side: 'left', shortcut: 'Alt+1', key: '1' });
registerToolWindow({ id: 'region-right', title: 'Thread', icon: IconThread, side: 'right', shortcut: 'Alt+9', key: '9' });

const OVERLAY_BREAKPOINT = 1100;

interface RegionNode {
  readonly object: ObjectRef;
  readonly instances: readonly ObjectRef[];
}

function regionsOf(root: SurfaceTreeNode | null): Map<string, RegionNode> {
  const map = new Map<string, RegionNode>();
  for (const child of root?.children ?? []) {
    map.set(child.object.id, {
      object: child.object,
      instances: child.children.map((node) => node.object),
    });
  }
  return map;
}

function StripeButton({
  registration,
  open,
  entranceIndex,
  onToggle,
}: {
  registration: ToolWindowRegistration;
  open: boolean;
  entranceIndex: number;
  onToggle: () => void;
}) {
  const durations = useMotionDurations();
  const Icon = registration.icon;
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
      title={`${registration.title} (${registration.shortcut})`}
      aria-label={`${registration.title} tool window`}
      aria-pressed={open}
      aria-keyshortcuts={registration.shortcut}
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
      </div>
      <div className="min-h-0 flex-1">
        {region.instances.map((instance) => (
          <ViewInstanceHost key={instance.id} instance={instance} host={host} />
        ))}
      </div>
    </motion.section>
  );
}

export function IntuiShell({ host }: { host: ConsoleBlockHost }) {
  const durations = useMotionDurations();
  const [layoutObjects, setLayoutObjects] = useState<readonly ObjectRef[] | null>(null);
  const [compact, setCompact] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const selectedRecordId = useShellStore((state) => state.selectedRecordId);

  // The arrangement is live data: query the surface object and subscribe.
  useEffect(() => {
    const set = host.query(surfaceQuery());
    setLayoutObjects(set.objects);
    const unsubscribe = set.subscribe((next) => setLayoutObjects(next.objects));
    return unsubscribe;
  }, [host]);

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

  const root = useMemo(
    () => (layoutObjects ? buildSurfaceTree(SURFACE_ID, layoutObjects) : null),
    [layoutObjects],
  );
  const regions = useMemo(() => regionsOf(root), [root]);
  const left = regions.get('region-left');
  const right = regions.get('region-right');
  const editor = regions.get('region-editor');

  const isOpen = useCallback(
    (region?: RegionNode) => Boolean(region && region.object.properties.open !== false),
    [],
  );

  const toggle = useCallback(
    (regionId: string) => {
      const region = regions.get(regionId);
      if (!region) return;
      void host.emit({
        kind: 'update',
        id: regionId,
        patch: { open: region.object.properties.open === false },
      });
    },
    [host, regions],
  );

  // Keyboard shortcuts toggle every registered tool window (Alt+key).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      for (const registration of [...toolWindowsFor('left'), ...toolWindowsFor('right')]) {
        if (event.key === registration.key) {
          event.preventDefault();
          toggle(registration.id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  // Splitter drags persist through the surface object (debounced write-back).
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLayout = useCallback(
    (sizes: number[]) => {
      if (!left || !editor || !right) return;
      const visible: string[] = [];
      if (isOpen(left)) visible.push('region-left');
      visible.push('region-editor');
      if (isOpen(right)) visible.push('region-right');
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        visible.forEach((regionId, index) => {
          const size = sizes[index];
          if (typeof size === 'number') {
            void host.emit({ kind: 'update', id: regionId, patch: { size } });
          }
        });
      }, 250);
    },
    [host, left, editor, right, isOpen],
  );

  if (!root || !editor) {
    return <div className="h-full w-full bg-ij-frame" aria-busy="true" />;
  }

  const leftOpen = isOpen(left);
  const rightOpen = isOpen(right);
  const sizeOf = (region: RegionNode | undefined, fallback: number) => {
    const value = region?.object.properties.size;
    return typeof value === 'number' ? value : fallback;
  };

  const editorPane = (
    <motion.div
      initial={durations.reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: seconds(durations.base),
        delay: seconds(durations.reduced ? 0 : DUR.slow - DUR.base) / 1,
        ease: EASE_OUT,
      }}
      className="h-full min-h-0"
    >
      <EditorTabs region={editor.object} instances={editor.instances} host={host} />
    </motion.div>
  );

  return (
    <div ref={shellRef} data-shell className="relative flex h-full min-h-0 flex-col bg-ij-frame">
      <MainToolbar />
      <div className="flex min-h-0 flex-1">
        {/* Left stripe */}
        <nav aria-label="Left tool window stripe" className="flex w-ij-stripe shrink-0 flex-col items-center gap-1 border-r border-ij-seam bg-ij-chrome py-1">
          {toolWindowsFor('left').map((registration, index) => (
            <StripeButton
              key={registration.id}
              registration={registration}
              open={isOpen(regions.get(registration.id))}
              entranceIndex={index}
              onToggle={() => toggle(registration.id)}
            />
          ))}
        </nav>

        <div className="relative min-h-0 min-w-0 flex-1">
          {compact ? (
            <>
              {editorPane}
              {leftOpen && left ? (
                <div className="absolute inset-y-0 left-0 z-30 w-80 border-r border-ij-seam shadow-none">
                  <ToolWindow region={left} host={host} entranceIndex={0} />
                </div>
              ) : null}
              {rightOpen && right ? (
                <div className="absolute inset-y-0 right-0 z-30 w-96 border-l border-ij-seam">
                  <ToolWindow region={right} host={host} entranceIndex={1} />
                </div>
              ) : null}
            </>
          ) : (
            <PanelGroup direction="horizontal" onLayout={onLayout}>
              {leftOpen && left ? (
                <>
                  <Panel id="region-left" order={1} defaultSize={sizeOf(left, 24)} minSize={14}>
                    <ToolWindow region={left} host={host} entranceIndex={0} />
                  </Panel>
                  <PanelResizeHandle className="w-px bg-ij-divider data-[resize-handle-state=drag]:bg-ij-accent" />
                </>
              ) : null}
              <Panel id="region-editor" order={2} defaultSize={sizeOf(editor, 48)} minSize={30}>
                {editorPane}
              </Panel>
              {rightOpen && right ? (
                <>
                  <PanelResizeHandle className="w-px bg-ij-divider data-[resize-handle-state=drag]:bg-ij-accent" />
                  <Panel id="region-right" order={3} defaultSize={sizeOf(right, 28)} minSize={16}>
                    <ToolWindow region={right} host={host} entranceIndex={1} />
                  </Panel>
                </>
              ) : null}
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
          {toolWindowsFor('right').map((registration, index) => (
            <StripeButton
              key={registration.id}
              registration={registration}
              open={isOpen(regions.get(registration.id))}
              entranceIndex={index + 1}
              onToggle={() => toggle(registration.id)}
            />
          ))}
        </nav>
      </div>
      <StatusBar />
      <SearchEverywhere host={host} />
    </div>
  );
}
