'use client';

// SOURCING: 21st/@arunjdass/dashboard-sidebar installed in
// components/ui/dashboard-sidebar.tsx and extended there with a rail-owned
// Obsidian JSON Canvas Z-layer. Identity workspaces + PLACE_ENTRIES / nav-item
// drive the nav; canvas persists via CanvasStore on canvas.inspector.rail.

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { BlockHost } from '@commonplace/block-view/types';
import { DashboardSidebar } from '@/components/ui/dashboard-sidebar';
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
  /** Matches the published SidebarNav width (260). */
  readonly panelWidth?: number;
  readonly className?: string;
  readonly footer?: ReactNode;
  readonly onNavSelect?: (id: string) => void;
}

function featureOn(sections: InspectorRailSections | undefined, key: InspectorRailSectionKey): boolean {
  return sections?.[key] !== false;
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
  panelWidth = 260,
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
  const [activeId, setActiveId] = useState(pathname || '/chat');
  const [workspaces, setWorkspaces] = useState<readonly IdentityWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | undefined>();
  const [activeWorkspaceName, setActiveWorkspaceName] = useState(workspaceName);

  useEffect(() => {
    setActiveId(pathname || '/chat');
  }, [pathname]);

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
      className={cn('relative flex h-full min-h-0 shrink-0 overflow-visible', className)}
      style={{ width: open ? panelWidth : 0 }}
    >
      <button
        type="button"
        data-inspector-rail-edge
        aria-label={open ? 'Collapse inspector rail' : 'Open inspector rail'}
        aria-expanded={open}
        className={cn(
          'absolute top-1/2 z-40 flex size-10 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] bg-transparent text-ij-ink-info transition-[transform,color] duration-200 ease-[cubic-bezier(0.25,1.1,0.4,1)]',
          'hover:-translate-y-[calc(50%+3px)] hover:text-ij-ink',
          open ? 'left-0 -translate-x-1/2' : 'right-2 translate-x-0',
        )}
        onClick={() => onOpenChange(!open)}
      >
        <img
          src="/icons/noun-layers-7815909.png"
          alt=""
          width={20}
          height={20}
          className="pointer-events-none size-5 object-contain opacity-80"
          aria-hidden
        />
      </button>

      <aside
        data-inspector-rail-panel
        className={cn(
          'ml-auto flex h-full min-h-0 flex-col overflow-hidden border-l border-border/50 bg-card transition-[width,opacity] duration-200 ease-[cubic-bezier(0.25,1.1,0.4,1)]',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{ width: open ? panelWidth : 0 }}
        aria-hidden={!open}
      >
        {open && showBody ? (
          <div className="flex h-full min-h-0 w-full flex-col" style={{ width: panelWidth }}>
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

            {footer ? (
              <footer className="shrink-0 border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground">
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
