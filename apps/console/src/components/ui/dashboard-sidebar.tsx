'use client';

// SOURCING: 21st/@arunjdass/dashboard-sidebar — installed as published, then
// extended in-component with a rail-owned Obsidian JSON Canvas 1.0 Z-layer
// (@commonplace/json-canvas + React Flow via JsonCanvasLayer). Product nav and
// workspaces bind to host nav-item + identity; Frame760 preview keeps mocks.
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  LogOut,
  Hash,
  ChevronDown,
  ChevronRight,
  Inbox,
  Calendar,
  Activity,
  CreditCard,
  Globe,
  Terminal,
  Blocks,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { JsonCanvasLayer } from '@/components/ui/json-canvas-layer';
import { cn } from '@/lib/cn';
import { PLACE_ENTRIES } from '@/lib/rail/rail-model';
import {
  deriveLabel,
  hostPropsToNavItem,
  NAV_ITEM_TYPE,
  type NavItem,
} from '@/lib/navigationRegistry';

export type NavItemData = {
  id: string;
  title: string;
  icon: LucideIcon;
  badge?: number | string;
  shortcut?: string;
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

const mockNavGroups: NavGroupData[] = [
  {
    items: [
      { id: 'search', title: 'Search', icon: Search, shortcut: '⌘K' },
      { id: 'home', title: 'Home', icon: LayoutDashboard },
      { id: 'inbox', title: 'Inbox', icon: Inbox, badge: 12 },
      { id: 'analytics', title: 'Analytics', icon: Activity },
    ]
  },
  {
    heading: 'Workspace',
    items: [
      { 
        id: 'projects', 
        title: 'Projects', 
        icon: FolderKanban,
        children: [
          { id: 'p-active', title: 'Active', icon: Hash },
          { id: 'p-archived', title: 'Archived', icon: Hash },
        ]
      },
      { id: 'calendar', title: 'Calendar', icon: Calendar },
      { 
        id: 'team', 
        title: 'Team', 
        icon: Users,
        children: [
          { id: 't-design', title: 'Designers', icon: Hash },
          { id: 't-eng', title: 'Engineering', icon: Hash },
          { id: 't-product', title: 'Product', icon: Hash },
        ]
      },
      { 
        id: 'customers', 
        title: 'Customers', 
        icon: Globe,
        children: [
          { id: 'c-enterprise', title: 'Enterprise', icon: Hash },
          { id: 'c-smb', title: 'SMB', icon: Hash },
        ]
      },
      { id: 'finance', title: 'Finance', icon: CreditCard },
    ]
  },
  {
    heading: 'Developers',
    items: [
      { id: 'api', title: 'API Keys', icon: Terminal },
      { id: 'webhooks', title: 'Webhooks', icon: Blocks },
    ]
  }
];

const mockBottomItems: NavItemData[] = [
  { id: 'settings', title: 'Settings', icon: Settings, shortcut: '⌘,' },
  { id: 'logout', title: 'Log out', icon: LogOut },
];

export type WorkspaceOption = {
  readonly id: string;
  readonly name: string;
};

function WorkspaceSwitcher({
  workspaces,
  selectedId,
  selectedName,
  onSelect,
}: {
  workspaces?: readonly WorkspaceOption[];
  selectedId?: string;
  selectedName?: string;
  onSelect?: (workspaceId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const options = workspaces ?? [
    { id: 'acme', name: 'Acme Corp' },
    { id: 'personal', name: 'Personal Workspace' },
    { id: 'sandbox', name: 'Client Sandbox' },
  ];
  const current =
    options.find((workspace) => workspace.id === selectedId)?.name
    ?? selectedName
    ?? options[0]?.name
    ?? 'Workspace';

  return (
    <div className="relative pointer-events-auto">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-2 py-2 mb-4 rounded-lg bg-card/85 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors select-none group backdrop-blur-[1px]"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-primary text-primary-foreground flex items-center justify-center font-semibold text-[13px] shadow-sm">
            {current.charAt(0)}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[13px] font-medium leading-none mb-1 text-foreground truncate max-w-[120px]">{current}</span>
            <span className="text-[11px] text-muted-foreground leading-none">Workspace</span>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground/70 transition-colors shrink-0" strokeWidth={1.5} />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-[52px] left-0 w-full bg-card border border-border/50 rounded-lg shadow-xl z-50 py-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
            {options.map((workspace) => (
              <div 
                key={workspace.id}
                onClick={() => { onSelect?.(workspace.id); setIsOpen(false); }}
                className={`px-3 py-2 mx-1 text-[13px] rounded-md cursor-pointer transition-colors ${
                  workspace.id === selectedId || workspace.name === current
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/80 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {workspace.name}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const PLACE_ICONS: Record<string, LucideIcon> = {
  chat: Inbox,
  survey: Search,
  index: Blocks,
  workspace: FolderKanban,
  model: Activity,
  editor: FolderKanban,
};

function buildPlaceNavGroup(): NavGroupData {
  return {
    heading: 'Places',
    items: PLACE_ENTRIES.map((place) => ({
      id: place.path,
      title: place.label,
      icon: PLACE_ICONS[place.kind] ?? LayoutDashboard,
    })),
  };
}

function buildObjectNavGroup(items: readonly NavItem[]): NavGroupData | null {
  const objectItems = items
    .filter((item) => item.itemKind.kind === 'object')
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: `object:${item.itemKind.kind === 'object' ? item.itemKind.objectTypeId : item.id}`,
      title: deriveLabel(item.itemKind),
      icon: Hash,
    }));
  if (objectItems.length === 0) return null;
  return { heading: 'Objects', items: objectItems };
}

function NavItem({ 
  item, 
  activeId, 
  onSelect,
  level = 0
}: { 
  item: NavItemData; 
  activeId: string; 
  onSelect: (id: string) => void;
  level?: number;
}) {
  const isActive = activeId === item.id;
  const hasChildren = !!item.children;
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else {
      onSelect(item.id);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div 
        className={`group pointer-events-auto flex items-center justify-between px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none
          ${isActive 
            ? 'bg-card/90 dark:bg-white/10 text-foreground font-medium backdrop-blur-[1px]' 
            : 'bg-card/55 text-muted-foreground hover:bg-card/80 hover:text-foreground/90 backdrop-blur-[1px]'
          }
        `}
        style={{ paddingLeft: `${level * 12 + 10}px` }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2.5">
          <item.icon 
            className={`w-[16px] h-[16px] transition-colors
              ${isActive ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground/70'}
            `} 
            strokeWidth={1.5} 
          />
          <span className="text-[13px] tracking-wide truncate">
            {item.title}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {item.shortcut && (
             <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-muted-foreground/60 bg-background/50 border border-border/50 rounded-[4px] shadow-xs">
               {item.shortcut}
             </kbd>
          )}
          {item.badge && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
              {item.badge}
            </span>
          )}
          {hasChildren && (
            <ChevronRight 
              className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 
              strokeWidth={2}
            />
          )}
        </div>
      </div>

      {hasChildren && (
        <div 
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0 relative flex flex-col gap-0.5 mt-0.5">
            <div 
              className="absolute top-0 bottom-0 border-l border-black/5 dark:border-white/5"
              style={{ left: `${level * 12 + 17.5}px` }}
            />
            {item.children!.map(child => (
              <NavItem 
                key={child.id} 
                item={child} 
                activeId={activeId} 
                onSelect={onSelect} 
                level={level + 1} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SidebarNav({ 
  className = '',
  activeId,
  onSelect,
  navGroups,
  bottomItems,
  workspaces,
  activeWorkspaceId,
  activeWorkspaceName,
  onWorkspaceSelect,
  /** When true, the shell lets the JSON Canvas Z-layer receive pointer events. */
  canvasPassThrough = false,
}: { 
  className?: string,
  activeId?: string,
  onSelect?: (id: string) => void,
  navGroups?: readonly NavGroupData[],
  bottomItems?: readonly NavItemData[],
  workspaces?: readonly WorkspaceOption[],
  activeWorkspaceId?: string,
  activeWorkspaceName?: string,
  onWorkspaceSelect?: (workspaceId: string) => void,
  canvasPassThrough?: boolean,
}) {
  const [internalId, setInternalId] = useState('home');
  const currentId = activeId !== undefined ? activeId : internalId;
  const handleSelect = onSelect || setInternalId;
  const groups = navGroups ?? mockNavGroups;
  const footerItems = bottomItems ?? mockBottomItems;

  return (
    <div
      data-sidebar-nav
      data-canvas-pass-through={canvasPassThrough ? 'true' : 'false'}
      className={cn(
        'flex w-[260px] h-full flex-col border-r border-border/50 p-3 font-sans',
        canvasPassThrough
          ? 'pointer-events-none bg-transparent'
          : 'bg-card/50',
        className,
      )}
    >
      <WorkspaceSwitcher
        workspaces={workspaces}
        selectedId={activeWorkspaceId}
        selectedName={activeWorkspaceName}
        onSelect={onWorkspaceSelect}
      />

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pointer-events-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {groups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {group.heading && (
              <span className="pointer-events-none px-2.5 mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">
                {group.heading}
              </span>
            )}
            {group.items.map(item => (
              <NavItem 
                key={item.id} 
                item={item} 
                activeId={currentId} 
                onSelect={handleSelect} 
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border/50 pt-4 pointer-events-none">
        {footerItems.map(item => (
          <NavItem 
            key={item.id} 
            item={item} 
            activeId={currentId} 
            onSelect={handleSelect} 
          />
        ))}
      </div>
    </div>
  );
}

export type DashboardSidebarProps = {
  readonly host: BlockHost;
  /** When false, only the published 21st nav chrome renders (no JSON Canvas layer). */
  readonly jsonCanvas?: boolean;
  readonly className?: string;
  readonly activeId?: string;
  readonly onSelect?: (id: string) => void;
  readonly workspaces?: readonly WorkspaceOption[];
  readonly activeWorkspaceId?: string;
  readonly activeWorkspaceName?: string;
  readonly onWorkspaceSelect?: (workspaceId: string) => void;
  readonly viewerUserId?: string;
};

/**
 * Product right-rail component: the published arunjdass SidebarNav surface with
 * a rail-owned Obsidian JSON Canvas Z-layer persisted through the host.
 */
export function DashboardSidebar({
  host,
  jsonCanvas = true,
  className = '',
  activeId,
  onSelect,
  workspaces,
  activeWorkspaceId,
  activeWorkspaceName,
  onWorkspaceSelect,
  viewerUserId = '',
}: DashboardSidebarProps) {
  const [navItems, setNavItems] = useState<readonly NavItem[]>([]);

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
          if (!viewerUserId) return true;
          return item.scope.userId === viewerUserId;
        });
      setNavItems(next);
    };
    void Promise.resolve(host.query({ types: [NAV_ITEM_TYPE], live: true })).then((set) => {
      if (!active) return;
      publish(set.objects);
      unsubscribe = set.subscribe((next) => publish(next.objects));
    }).catch(() => {
      if (!active) return;
      setNavItems([]);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [host, viewerUserId]);

  const navGroups = useMemo(() => {
    const groups: NavGroupData[] = [buildPlaceNavGroup()];
    const objects = buildObjectNavGroup(navItems);
    if (objects) groups.push(objects);
    return groups;
  }, [navItems]);

  const bottomItems: NavItemData[] = [
    { id: '/account', title: 'Settings', icon: Settings, shortcut: '⌘,' },
  ];

  return (
    <div
      data-dashboard-sidebar
      data-json-canvas={jsonCanvas ? 'true' : 'false'}
      className={cn('relative h-full min-h-0 w-full overflow-hidden font-sans', className)}
    >
      {jsonCanvas ? (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <JsonCanvasLayer host={host} />
        </div>
      ) : null}

      <div
        className={cn(
          'relative z-10 h-full min-h-0 w-full',
          jsonCanvas && 'pointer-events-none',
        )}
      >
        <SidebarNav
          className={cn(
            '!h-full !w-full !border-r-0 !border-l-0',
            jsonCanvas
              ? '!bg-transparent'
              : 'bg-card/80 backdrop-blur-[1px]',
          )}
          canvasPassThrough={jsonCanvas}
          activeId={activeId}
          onSelect={onSelect}
          navGroups={navGroups}
          bottomItems={bottomItems}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          activeWorkspaceName={activeWorkspaceName}
          onWorkspaceSelect={onWorkspaceSelect}
        />
      </div>
    </div>
  );
}

const allItems = [...mockNavGroups.flatMap(g => g.items), ...mockBottomItems];
const flattenItems = (items: NavItemData[]): NavItemData[] => {
  return items.reduce((acc, item) => {
    acc.push(item);
    if (item.children) acc.push(...flattenItems(item.children));
    return acc;
  }, [] as NavItemData[]);
};
const flatMockData = flattenItems(allItems);

export function SidebarNavPreview() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeId, setActiveId] = useState('home');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('acme');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const activeItem = flatMockData.find(i => i.id === activeId);
  const activeTitle = activeItem ? activeItem.title : 'Dashboard';
  const activeWorkspace =
    [{ id: 'acme', name: 'Acme Corp' }, { id: 'personal', name: 'Personal Workspace' }, { id: 'sandbox', name: 'Client Sandbox' }]
      .find((workspace) => workspace.id === activeWorkspaceId)?.name
    ?? 'Acme Corp';

  const handleSelect = (id: string) => {
    if (id === 'search') {
      setIsSearchOpen(true);
      return;
    }
    setActiveId(id);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[700px] bg-background p-4 md:p-8">
      
      
      <div className="relative w-full max-w-4xl h-[700px] bg-card rounded-xl border border-border/50 flex overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        
        
        <div 
          className={`h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden bg-card/50 border-r border-border/50 ${
            isOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 border-none'
          }`}
        >
          
          <SidebarNav 
            className="w-[260px] border-none bg-transparent" 
            activeId={activeId}
            onSelect={handleSelect}
            activeWorkspaceId={activeWorkspaceId}
            activeWorkspaceName={activeWorkspace}
            onWorkspaceSelect={setActiveWorkspaceId}
          />
        </div>
        
        
        <div className="flex-1 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col min-w-0 transition-all duration-300">
           
           
           <div className="h-14 border-b border-border/50 flex items-center px-4 justify-between bg-card shrink-0">
             <div className="flex items-center gap-3">
               <button 
                 onClick={() => setIsOpen(!isOpen)}
                 className="p-1.5 rounded-md text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-colors"
               >
                 {isOpen ? <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.5} /> : <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />}
               </button>
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <span className="truncate">{activeWorkspace}</span>
                 <span>/</span>
                 <span className="font-medium text-foreground truncate">{activeTitle}</span>
               </div>
             </div>
             
             <div className="flex items-center gap-3">
               <div className="w-64 h-8 bg-black/5 dark:bg-white/5 rounded-md hidden md:block" />
               <div className="w-8 h-8 bg-primary/10 rounded-full border border-primary/20" />
             </div>
           </div>

           
           <div className="p-6 md:p-8 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
             <div className="flex items-center justify-between mb-8">
               <div className="w-48 h-8 bg-black/5 dark:bg-white/5 rounded-md" />
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div className="h-32 bg-card rounded-xl border border-border/50 shadow-sm" />
               <div className="h-32 bg-card rounded-xl border border-border/50 shadow-sm" />
             </div>

             <div className="w-full bg-card rounded-xl border border-border/50 shadow-sm p-6">
                <div className="w-1/3 h-5 bg-black/5 dark:bg-white/5 rounded-md mb-6" />
                <div className="w-full h-[1px] bg-border/50 mb-6" />
                
                <div className="flex flex-col gap-4">
                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />
                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />
                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />
                <div className="w-full h-12 bg-black/5 dark:bg-white/5 rounded-lg" />
               </div>
             </div>
           </div>
        </div>

        
        {isSearchOpen && (
          <div className="absolute inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/40 backdrop-blur-sm px-4">
            <div className="absolute inset-0" onClick={() => setIsSearchOpen(false)} />
            <div className="relative w-full max-w-xl bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center px-4 border-b border-border/50">
                <Search className="w-[18px] h-[18px] text-muted-foreground/70 mr-3 shrink-0" strokeWidth={1.5} />
                <input 
                  autoFocus
                  className="flex-1 bg-transparent py-4 outline-none text-[14px] text-foreground placeholder:text-muted-foreground/50"
                  placeholder="Search projects, docs, or actions..."
                />
                <kbd 
                  onClick={() => setIsSearchOpen(false)}
                  className="hidden sm:inline-flex items-center justify-center h-5 px-1.5 ml-2 text-[10px] font-medium font-mono text-muted-foreground/70 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-[4px] cursor-pointer hover:text-foreground hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                >
                  ESC
                </kbd>
                <button 
                  onClick={() => setIsSearchOpen(false)}
                  className="ml-3 p-1 rounded-md text-muted-foreground/70 hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground transition-colors"
                >
                  <X className="w-[18px] h-[18px]" strokeWidth={1.5} />
                </button>
              </div>
              <div className="p-2 py-8 flex flex-col items-center justify-center">
                 <Command className="w-6 h-6 text-muted-foreground/30 mb-2" strokeWidth={1.5} />
                 <p className="text-[13px] text-muted-foreground font-medium">Type a command or search...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
