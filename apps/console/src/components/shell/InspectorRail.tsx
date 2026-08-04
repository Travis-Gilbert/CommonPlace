'use client';

// SOURCING: 21st/@arunjdass/dashboard-sidebar installed in
// components/ui/dashboard-sidebar.tsx and extended there with a rail-owned
// Obsidian JSON Canvas Z-layer. Identity workspaces + PLACE_ENTRIES / nav-item
// drive the nav; canvas persists via CanvasStore on canvas.inspector.rail.
//
// The edge control's glyph is IconLayers from the one icon file, not the
// noun-layers PNG this rail first shipped with. A raster mark cannot take
// currentColor, so the affordance could not follow ink through hover, theme,
// or mode; the vector primitive is the same Noun figure and does.
//
// Width is the container's, never this component's. In the shell the rail is a
// collapsible react-resizable-panels Panel, so drag-to-size, the collapsed
// state, and persistence across reload are all the library's (the ledger's
// split-geometry row), not a `panelWidth` prop animating to zero. `open` only
// says whether to render the body; the Panel decides how wide that body is.

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { BlockHost } from '@commonplace/block-view/types';
import { DashboardSidebar } from '@/components/ui/dashboard-sidebar';
import { RailInsights } from '@/components/shell/RailInsights';
import { RailActionCluster } from '@/components/shell/RailActionCluster';
import { IconLayers } from '@/components/shell/icons';
import { cn } from '@/lib/cn';
import { softNavigate } from '@/lib/soft-navigate';
import {
  getIdentitySession,
  selectIdentityWorkspace,
} from '@/lib/identity/client';
import type { IdentityWorkspace } from '@/lib/identity/contracts';
export type InspectorRailSectionKey = 'nav' | 'canvas';

export type InspectorRailSections = Partial<Record<InspectorRailSectionKey, boolean>>;

export interface InspectorRailProps {
  readonly host: BlockHost;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * Feature toggles for the integrated DashboardSidebar.
   * `nav: false` hides the whole panel body; `canvas: false` disables the
   * JSON Canvas feature layer inside the component (does not stack a second UI).
   */
  readonly sections?: InspectorRailSections;
  /** Fallback label before identity session resolves. */
  readonly workspaceName?: string;
  readonly className?: string;
  readonly footer?: ReactNode;
  readonly onNavSelect?: (id: string) => void;
}

function featureOn(sections: InspectorRailSections | undefined, key: InspectorRailSectionKey): boolean {
  return sections?.[key] !== false;
}

const RAIL_EDGE_CLASS =
  'flex size-10 items-center justify-center rounded-(--radius-control) bg-transparent text-ij-ink-info transition-[transform,color] duration-(--ij-motion) ease-(--ij-ease) hover:-translate-y-1 hover:text-ij-ink';

/**
 * The reopen affordance, which cannot live inside the rail. A collapsed rail is
 * a zero-width Panel that clips its own overflow, so a control in there is both
 * unclickable and still in the accessibility tree: a dead button a screen
 * reader would still offer. Whoever owns the collapsed state renders this
 * beside the rail instead, inside a positioned ancestor.
 */
export function InspectorRailReopen({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <div className="absolute right-2 top-1/2 z-40 -translate-y-1/2">
      <button
        type="button"
        data-inspector-rail-reopen
        aria-label="Open inspector rail"
        aria-expanded={false}
        className={RAIL_EDGE_CLASS}
        onClick={onOpen}
      >
        <IconLayers size={20} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Right rail host for the integrated DashboardSidebar (21st nav + JSON Canvas
 * feature). Edge control overlays when collapsed.
 */
export function InspectorRail({
  host,
  open,
  onOpenChange,
  sections,
  workspaceName = 'CommonPlace',
  className,
  footer,
  onNavSelect,
}: InspectorRailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const viewerUserId =
    session?.user?.harnessIdentity
    ?? session?.user?.githubLogin
    ?? '';
  const routeId = pathname || '/chat';
  const [activeId, setActiveId] = useState(routeId);
  const [seenRouteId, setSeenRouteId] = useState(routeId);
  const [workspaces, setWorkspaces] = useState<readonly IdentityWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | undefined>();
  const [activeWorkspaceName, setActiveWorkspaceName] = useState(workspaceName);

  // Selection is optimistic: a click highlights before the route settles, then
  // the route reasserts. Adjusting during render is the shell's idiom for that
  // (IntuiShell does the same with the sidebar's collapsed flag) and it is the
  // reason react-hooks/set-state-in-effect rejects the effect form: an effect
  // paints the stale row first and corrects it on a second pass.
  if (routeId !== seenRouteId) {
    setSeenRouteId(routeId);
    setActiveId(routeId);
  }

  useEffect(() => {
    let active = true;
    void getIdentitySession()
      .then((identity) => {
        if (!active) return;
        setWorkspaces(identity.workspaces);
        const preferred =
          identity.workspaces.find((workspace) => workspace.name === workspaceName)
          ?? identity.workspaces[0];
        if (preferred) {
          setActiveWorkspaceId(preferred.id);
          setActiveWorkspaceName(preferred.name);
        } else {
          setActiveWorkspaceName(workspaceName);
        }
      })
      .catch(() => {
        if (!active) return;
        setWorkspaces([]);
        setActiveWorkspaceName(workspaceName);
      });
    return () => {
      active = false;
    };
  }, [workspaceName]);

  const handleSelect = (id: string) => {
    setActiveId(id);
    onNavSelect?.(id);
    if (id.startsWith('object:')) {
      const objectTypeId = id.slice('object:'.length);
      void softNavigate(router, `/records?type=${encodeURIComponent(objectTypeId)}`);
      return;
    }
    if (id.startsWith('/')) {
      void softNavigate(router, id);
    }
  };

  const handleWorkspaceSelect = (workspaceId: string) => {
    const selected = workspaces.find((workspace) => workspace.id === workspaceId);
    setActiveWorkspaceId(workspaceId);
    if (selected) setActiveWorkspaceName(selected.name);
    void selectIdentityWorkspace(workspaceId).catch(() => {
      // Keep local selection; principal cookie update is best-effort for the rail.
    });
  };

  const showBody = featureOn(sections, 'nav');
  const jsonCanvas = featureOn(sections, 'canvas');

  return (
    <div
      data-inspector-rail
      data-open={open ? 'true' : 'false'}
      className={cn('relative flex h-full min-h-0 w-full overflow-hidden', className)}
    >
      {/* The centering translate lives on the wrapper so the button's own
          transform is free for the hover lift. A -translate-y-[calc(50%+3px)]
          that has to restate the centering is an arbitrary value the register
          lint rejects, and it re-derives the same number in two places.
          It sits fully inside the rail's left edge rather than straddling it:
          a Panel clips its own overflow, so half a control hanging outside
          would be cut off rather than centered on the seam. Collapse only:
          reopening is InspectorRailReopen's job, outside the rail. */}
      {open ? (
        <div className="absolute left-0 top-1/2 z-40 -translate-y-1/2">
          <button
            type="button"
            data-inspector-rail-edge
            aria-label="Collapse inspector rail"
            aria-expanded
            className={RAIL_EDGE_CLASS}
            onClick={() => onOpenChange(false)}
          >
            <IconLayers size={20} aria-hidden />
          </button>
        </div>
      ) : null}

      {/* A drawer out of the right edge, not a card floating near it. The rail
          meets the window on its right and along both its long sides, and only
          its left corners are round, so the curve reads as the edge it emerged
          from rather than as a rectangle set down on the ground. It was inset
          on all four sides first; against a shell that now runs full bleed,
          that read as a card someone had left lying on the surface. Radius and
          surface come from the register rather than restated values. */}
      <aside
        data-inspector-rail-panel
        className={cn(
          'ml-auto flex h-full min-h-0 w-full flex-col overflow-hidden',
          'rounded-l-ij-island bg-card transition-opacity duration-(--ij-motion) ease-(--ij-ease)',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!open}
      >
        {open && showBody ? (
          <div className="flex h-full min-h-0 w-full flex-col">
            {/* The reference's reading order: what the agent is doing, then the
                thing it is doing it to, then what you can do about it. The
                insights list shrinks to nothing when it has nothing true to
                show, so the canvas keeps the height rather than the rail
                reserving space for an empty heading. */}
            <RailInsights className="max-h-1/3 px-1 pt-2" />

            <div className="min-h-0 flex-1 overflow-hidden" data-inspector-section="dashboard">
              <DashboardSidebar
                host={host}
                jsonCanvas={jsonCanvas}
                activeId={activeId}
                onSelect={handleSelect}
                workspaces={workspaces.map((workspace) => ({
                  id: workspace.id,
                  name: workspace.name,
                }))}
                activeWorkspaceId={activeWorkspaceId}
                activeWorkspaceName={activeWorkspaceName}
                onWorkspaceSelect={handleWorkspaceSelect}
                viewerUserId={viewerUserId}
              />
            </div>

            <RailActionCluster
              onOpenCanvas={() => void softNavigate(router, '/Data-model')}
              onCollapse={() => onOpenChange(false)}
            />

            {footer ? (
              <footer className="shrink-0 border-t border-border/50 px-3 py-2 text-ij-island-meta text-muted-foreground">
                {footer}
              </footer>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

/** Chat: integrated 21st nav with JSON Canvas feature enabled. */
export const CHAT_INSPECTOR_SECTIONS: InspectorRailSections = {
  nav: true,
  canvas: true,
};

/** Console: same integrated surface. */
export const CONSOLE_INSPECTOR_SECTIONS: InspectorRailSections = {
  nav: true,
  canvas: true,
};
