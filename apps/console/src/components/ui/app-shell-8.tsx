// SOURCING: keenthemes/reui app-shell-8 block. The app-shell blocks are
// licensed and absent from the public repository, so this port is rebuilt
// from the live preview DOM: structure, behavior, and fixture data carry
// over, painted onto the local ui/ primitive set (radix-ui through the ui/
// components, cmdk for the command dialog) plus the twenty-ui fork (Avatar,
// Pill, ProgressBar, Tabler icons), all register-skinned. Tabler glyphs with
// no fork export (Package, Shopping cart, Truck, Arrows left right, Chevrons
// up down) map to near-equivalent icons already in the fork; the swap is
// called out here so the mapping stays reviewable. The inner rail collapses
// by snap, never by width or left animation (motion register rule 1).
// Registry install: metric arbitrary values are legal, colors stay
// register-resolved.
'use client';

import { useEffect, useId, useState } from 'react';
import type { ComponentType } from 'react';
import { Avatar, Pill } from 'twenty-ui/data-display';
import { ProgressBar } from 'twenty-ui/feedback';
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowsSort,
  IconBell,
  IconBox,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconChartBar,
  IconChartLine,
  IconCirclePlus,
  IconCoins,
  IconCreditCard,
  IconFileImport,
  IconFileText,
  IconHome,
  IconLayoutGrid,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconMessage,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShield,
  IconStar,
  IconSwitchHorizontal,
  IconTag,
  IconTarget,
  IconUser,
  IconUserPlus,
  IconUsers,
} from 'twenty-ui/icon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type IconType = ComponentType<{ size?: number; className?: string }>;

interface RailItem {
  label: string;
  icon: IconType;
  active?: boolean;
}

interface NavItem {
  label: string;
  icon: IconType;
  active?: boolean;
  count?: number;
}

const NICK_AVATAR_URL =
  'https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80';

const RAIL_ITEMS: readonly RailItem[] = [
  { label: 'Home', icon: IconHome, active: true },
  { label: 'Package', icon: IconBox },
  { label: 'Shopping cart', icon: IconCoins },
  { label: 'Users', icon: IconUsers },
  { label: 'Messages', icon: IconMessage },
  { label: 'Analytics', icon: IconChartBar },
  { label: 'Settings', icon: IconSettings },
];

const CATALOG_NAV: readonly NavItem[] = [
  { label: 'Product Catalog', icon: IconLayoutGrid, active: true },
  { label: 'Categories', icon: IconTag },
  { label: 'Customer Reviews', icon: IconStar, count: 20 },
];

const OPERATIONS_NAV: readonly NavItem[] = [
  { label: 'Transactions', icon: IconSwitchHorizontal },
  { label: 'Suppliers', icon: IconArchive },
  { label: 'Warehouses', icon: IconHome },
  { label: 'Stock Alerts', icon: IconAlertTriangle, count: 4 },
];

const CREATE_ACTIONS: readonly { label: string; icon: IconType }[] = [
  { label: 'New Product', icon: IconBox },
  { label: 'New Order', icon: IconCoins },
  { label: 'New Customer', icon: IconUserPlus },
  { label: 'Import Data', icon: IconFileImport },
  { label: 'Generate Report', icon: IconChartLine },
];

const ORGANIZATIONS: readonly { name: string; plan: string }[] = [
  { name: 'Acme Inc', plan: 'Pro' },
  { name: 'Starter Kit', plan: 'Free' },
  { name: 'Enterprise', plan: 'Enterprise' },
];

const APPLICATIONS: readonly { label: string; icon: IconType }[] = [
  { label: 'Inventory', icon: IconLayoutGrid },
  { label: 'Storefront', icon: IconBuildingSkyscraper },
  { label: 'Analytics', icon: IconChartLine },
];

const NOTIFICATIONS: readonly {
  icon: IconType;
  title: string;
  description: string;
  time: string;
  meeting?: boolean;
}[] = [
  {
    icon: IconTarget,
    title: 'Goal',
    description: '500 orders',
    time: '5 hours ago',
  },
  {
    icon: IconCalendarEvent,
    title: 'Supplier meeting reminder',
    description: 'Mar 10, 2026, 2:00 PM - 3:00 PM',
    time: '6 hours ago',
    meeting: true,
  },
  {
    icon: IconFileText,
    title: '@sarah_r shared a report',
    description: 'inventory-march.pdf (3.2 MB)',
    time: 'Yesterday',
  },
  {
    icon: IconCreditCard,
    title: 'Payment processed',
    description: '$49.00',
    time: 'Yesterday',
  },
  {
    icon: IconShield,
    title: 'New login detected',
    description: 'Chrome on macOS',
    time: 'Yesterday',
  },
];

/** The ws-acme workspace mark: a gradient disc rebuilt from register tokens. */
function LogoMark({ className }: { className?: string }) {
  const gradientId = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={cn('block', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${gradientId}-acme`}
          x1="0"
          y1="0"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--ij-link)" />
          <stop offset="100%" stopColor="var(--ij-room)" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="14" fill={`url(#${gradientId}-acme)`} />
    </svg>
  );
}

function RailItemButton({ item }: { item: RailItem }) {
  const Icon = item.icon;
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            className={cn(
              'flex size-7 items-center justify-center rounded-ij-arc outline-none focus-visible:ring-2 focus-visible:ring-ij-accent',
              item.active
                ? 'bg-accent text-accent-foreground'
                : 'text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink',
            )}
          >
            <Icon size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

function IconRail() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-center justify-center py-3">
        <span className="flex size-7 items-center justify-center rounded-ij-arc bg-ij-accent text-ij-ink-bright">
          <LogoMark className="size-3.5" />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ul className="flex w-full min-w-0 flex-col items-center gap-0.5">
          {RAIL_ITEMS.map((item) => (
            <RailItemButton key={item.label} item={item} />
          ))}
        </ul>
      </div>
      <div className="flex flex-col py-3">
        <ProfileMenu />
      </div>
    </div>
  );
}

function NavButton({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-current={item.active ? 'page' : undefined}
      className={cn(
        'flex h-7 w-full items-center justify-start gap-2.5 rounded-ij-arc px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ij-accent',
        item.active
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink',
      )}
    >
      <span className="shrink-0 opacity-70">
        <Icon size={16} />
      </span>
      <span className="truncate">{item.label}</span>
      {item.count !== undefined && item.count > 0 ? (
        <Pill label={String(item.count)} className="ml-auto text-ij-ink-info" />
      ) : null}
    </button>
  );
}

function NavSection({ title, items }: { title: string; items: readonly NavItem[] }) {
  return (
    <div>
      <p className="px-3 pt-2 pb-1 text-[11px] font-medium text-ij-ink-info uppercase">
        {title}
      </p>
      <div className="flex flex-col gap-0.5 px-2">
        {items.map((item) => (
          <NavButton key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

function SecondaryNav() {
  return (
    <nav className="flex flex-col py-1" aria-label="Inventory navigation">
      <NavSection title="Catalog" items={CATALOG_NAV} />
      <Separator className="my-2" />
      <NavSection title="Operations" items={OPERATIONS_NAV} />
    </nav>
  );
}

function StorageUsage() {
  return (
    <div className="shrink-0 border-t border-ij-seam p-3">
      <div className="space-y-2">
        <p className="text-xs font-medium text-ij-warn">Storage Usage</p>
        <p className="text-[11px] leading-snug text-ij-ink-info">
          Warehouse capacity across all locations
        </p>
        <div className="bg-muted/55 relative h-1.5 overflow-hidden rounded-sm">
          <div
            className="text-ij-ink-info pointer-events-none absolute inset-0 opacity-20"
            aria-hidden="true"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, currentcolor 0px, currentcolor 1px, transparent 0px, transparent 4px)',
            }}
          />
          <ProgressBar
            value={74}
            barColor="var(--ij-warn)"
            className="absolute inset-0"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] leading-none">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-ij-ink tabular-nums">74%</span>
            <span className="text-ij-ink-info">Used</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-ij-ink tabular-nums">26%</span>
            <span className="text-ij-ink-info">Free</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollapseRail({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={collapsed ? 'Expand inner sidebar' : 'Collapse inner sidebar'}
      onClick={onToggle}
      className="group/rail fixed top-1/2 z-30 hidden h-12 w-7 -translate-y-1/2 cursor-pointer items-center pl-2 outline-none focus-visible:rounded-ij-arc focus-visible:ring-2 focus-visible:ring-ij-accent lg:flex"
      style={{ left: collapsed ? 64 : 264 }}
    >
      <span className="flex flex-col items-center" aria-hidden="true">
        <span className="bg-ij-ink-disabled block h-2 w-0.5 origin-bottom rounded-t-full transition-transform duration-(--ij-motion) ease-(--ij-ease) group-hover/rail:bg-ij-ink group-hover/rail:rotate-40" />
        <span className="bg-ij-ink-disabled block h-2 w-0.5 origin-top rounded-b-full transition-transform duration-(--ij-motion) ease-(--ij-ease) group-hover/rail:bg-ij-ink group-hover/rail:-rotate-40" />
      </span>
      <span className="bg-ij-raised border-ij-seam absolute left-full -ml-2 border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap opacity-0 transition-opacity duration-(--ij-motion) ease-(--ij-ease) group-hover/rail:opacity-100">
        {collapsed ? 'Expand' : 'Collapse'}
      </span>
    </button>
  );
}

function WorkspaceSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-ij-ink min-w-0 shrink"
          aria-label="Switch workspace"
        >
          <span className="inline-flex size-3 shrink-0 items-center justify-center leading-none">
            <LogoMark className="block size-full" />
          </span>
          <span className="sr-only leading-none truncate sm:not-sr-only">
            Acme Inc
          </span>
          <IconArrowsSort size={14} className="shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {ORGANIZATIONS.map((org) => (
          <DropdownMenuItem key={org.name} className="gap-2.5">
            {org.name === 'Acme Inc' ? (
              <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-ij-arc">
                <LogoMark className="size-full" />
              </span>
            ) : org.name === 'Enterprise' ? (
              <span className="bg-ij-chrome border-ij-seam flex size-5 shrink-0 items-center justify-center rounded-ij-arc border">
                <IconBuildingSkyscraper size={12} />
              </span>
            ) : (
              <span className="bg-ij-chrome border-ij-seam flex size-5 shrink-0 items-center justify-center rounded-ij-arc border">
                <IconBox size={12} />
              </span>
            )}
            <span className="truncate">{org.name}</span>
            <span className="text-ij-ink-info ml-auto text-[11px] tabular-nums">
              {org.plan}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <IconCirclePlus size={16} />
          Create Organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ApplicationSwitcher({ label }: { label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-ij-ink min-w-0 shrink"
          aria-label={`Switch application, currently ${label}`}
        >
          <span className="truncate">{label}</span>
          <IconArrowsSort size={14} className="shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Applications</DropdownMenuLabel>
        {APPLICATIONS.map((app) => {
          const Icon = app.icon;
          return (
            <DropdownMenuItem key={app.label} className="gap-2.5">
              <span className="bg-ij-chrome border-ij-seam flex size-5 shrink-0 items-center justify-center rounded-ij-arc border">
                <Icon size={12} />
              </span>
              <span className="truncate">{app.label}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <IconCirclePlus size={16} />
          Create Application
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" aria-label="Create">
          <IconPlus size={14} />
          <span className="sr-only sm:not-sr-only">Create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {CREATE_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem key={action.label}>
              <Icon size={16} />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({
  notification,
}: {
  notification: (typeof NOTIFICATIONS)[number];
}) {
  const Icon = notification.icon;
  return (
    <div className="flex gap-3 px-4 py-3">
      <span className="bg-ij-hover-surface text-ij-ink-info mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-ij-arc">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium text-ij-ink">
            {notification.title}
          </p>
          <span className="text-ij-ink-info shrink-0 text-[11px]">
            {notification.time}
          </span>
        </div>
        <p className="truncate text-xs text-ij-ink-info">
          {notification.description}
        </p>
        {notification.meeting ? (
          <div className="mt-2 flex items-center gap-2">
            <Button size="xs">Join</Button>
            <Button size="xs" variant="ghost">
              Decline
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NotificationsMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label="Notifications"
        >
          <IconBell size={16} className="opacity-60" />
          <span
            className="bg-ij-accent absolute top-0.5 right-1 size-1.5 rounded-full"
            aria-hidden="true"
          />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Updates across your workspace</SheetDescription>
        </SheetHeader>
        <div className="flex-1 divide-y divide-ij-seam overflow-y-auto">
          {NOTIFICATIONS.map((notification) => (
            <NotificationRow
              key={notification.title}
              notification={notification}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="mx-auto"
          aria-label="Open profile for Nick Bold"
        >
          <Avatar
            avatarUrl={NICK_AVATAR_URL}
            placeholder="Nick Bold"
            size="lg"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-52">
        <DropdownMenuLabel>
          <p className="text-sm font-medium text-ij-ink">Nick Bold</p>
          <p className="text-ij-ink-info text-xs">nick@acme.io</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <IconUser size={16} />
          View profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconSettings size={16} />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconCreditCard size={16} />
          Billing
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <IconLogout size={16} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <IconLayoutSidebarLeftExpand size={16} />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <SheetHeader className="border-ij-seam flex-row items-center gap-2 border-b px-4 py-3">
          <LogoMark className="size-6 shrink-0" />
          <div className="min-w-0">
            <SheetTitle className="text-sm">Acme Inc</SheetTitle>
            <SheetDescription className="text-[11px]">
              Inventory workspace
            </SheetDescription>
          </div>
        </SheetHeader>
        <ScrollArea className="min-h-0 grow">
          <div className="flex flex-col gap-0.5 p-2">
            {RAIL_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  aria-current={item.active ? 'page' : undefined}
                  className={cn(
                    'flex h-7 items-center gap-2.5 rounded-ij-arc px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ij-accent',
                    item.active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink',
                  )}
                >
                  <Icon size={16} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
        <div className="border-ij-seam shrink-0 border-t p-3">
          <div className="flex items-center gap-2.5">
            <Avatar avatarUrl={NICK_AVATAR_URL} placeholder="Nick Bold" size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ij-ink">
                Nick Bold
              </p>
              <p className="text-ij-ink-info text-[11px]">nick@acme.io</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppShell8() {
  const [innerCollapsed, setInnerCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="bg-background text-ij-ink flex h-screen w-full overflow-hidden">
        <aside
          className="border-ij-seam hidden w-16 shrink-0 flex-col border-r md:flex"
          aria-label="Main navigation"
        >
          <IconRail />
        </aside>

        <CollapseRail
          collapsed={innerCollapsed}
          onToggle={() => setInnerCollapsed((value) => !value)}
        />

        <main className="relative flex w-full flex-1 flex-col overflow-hidden">
          <header className="bg-background border-ij-seam sticky top-0 z-50 flex h-[50px] w-full items-center gap-2 border-b px-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
              <MobileNavSheet />
              <nav aria-label="breadcrumb" className="min-w-0 flex-1">
                <ol className="flex flex-nowrap items-center gap-1">
                  <li className="inline-flex min-w-9 items-center">
                    <WorkspaceSwitcher />
                  </li>
                  <li
                    className="shrink-0 text-xs opacity-60"
                    aria-hidden="true"
                  >
                    /
                  </li>
                  <li className="hidden min-w-0 items-center sm:flex">
                    <ApplicationSwitcher label="Inventory" />
                  </li>
                  <li
                    className="hidden shrink-0 text-xs opacity-60 sm:flex"
                    aria-hidden="true"
                  >
                    /
                  </li>
                  <li className="inline-flex min-w-0 items-center">
                    <ApplicationSwitcher label="Production" />
                  </li>
                </ol>
              </nav>
            </div>

            <div className="ml-auto flex items-center lg:absolute lg:left-1/2 lg:-translate-x-1/2">
              <button
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
                className="flex size-7 items-center justify-center rounded-ij-arc outline-none focus-visible:ring-2 focus-visible:ring-ij-accent sm:hidden"
              >
                <IconSearch size={16} className="opacity-60" />
              </button>
              <button
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
                className="hidden w-48 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ij-accent sm:flex lg:w-52 xl:w-80"
              >
                <span className="border-ij-seam bg-muted/40 flex h-8 w-full min-w-0 items-center gap-2 rounded-full border px-3">
                  <IconSearch size={14} className="shrink-0 opacity-60" />
                  <span className="text-ij-ink-info flex-1 truncate text-sm">
                    Search...
                  </span>
                  <KbdGroup className="shrink-0">
                    <Kbd>⌘</Kbd>
                    <Kbd>K</Kbd>
                  </KbdGroup>
                </span>
              </button>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <CreateMenu />
              <NotificationsMenu />
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-row">
            <aside
              aria-label="Inventory navigation"
              className={cn(
                'border-ij-seam hidden shrink-0 overflow-hidden border-r md:flex',
                innerCollapsed && 'md:hidden',
              )}
            >
              <div className="flex w-[200px] shrink-0 flex-col overflow-hidden">
                <ScrollArea className="min-h-0 grow">
                  <SecondaryNav />
                </ScrollArea>
                <StorageUsage />
              </div>
            </aside>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="bg-muted/40 border-ij-seam/40 aspect-video rounded-ij-arc border border-dashed"
                  />
                ))}
              </div>
              <div className="bg-muted/40 border-ij-seam/40 min-h-24 flex-1 rounded-ij-arc border border-dashed" />
            </div>
          </div>
        </main>

        <CommandDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          title="Search"
          description="Search your workspace content."
        >
          <CommandInput placeholder="Search products, orders, customers, reports..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Records">
              <CommandItem onSelect={() => setSearchOpen(false)}>
                <IconBox size={16} />
                Search products
              </CommandItem>
              <CommandItem onSelect={() => setSearchOpen(false)}>
                <IconCoins size={16} />
                Search orders
              </CommandItem>
              <CommandItem onSelect={() => setSearchOpen(false)}>
                <IconUserPlus size={16} />
                Search customers
              </CommandItem>
              <CommandItem onSelect={() => setSearchOpen(false)}>
                <IconArchive size={16} />
                Search suppliers
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => setSearchOpen(false)}>
                <IconChartLine size={16} />
                Generate report
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </TooltipProvider>
  );
}
