'use client';

// SOURCING: hand-roll (Sidebar palette). Spec CS7: Views / Blocks / Objects /
// Pins. IntelliJ stripe inspiration stays for chrome density; this palette is
// the block-view composition surface. Clicking a block adds without navigating.

import { useEffect, useMemo, useState } from 'react';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { listSavedViews, markViewDirty, viewPath, type SurfaceViewSummary } from '@/lib/surface-object';
import { materialForKind } from '@/components/block/BlockShell';
import {
  deriveLabel,
  type NavItem,
} from '@/lib/navigationRegistry';
import {
  IconDoc,
  IconMemory,
  IconModel,
  IconRail,
  IconRecords,
  IconThread,
  IconWorkspace,
} from '@/components/shell/icons';

export interface BlockPaletteItem {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly descriptorId: string;
  readonly material: 'sunken' | 'lifted' | 'docked';
}

export const BLOCK_PALETTE: readonly BlockPaletteItem[] = [
  { id: 'chat', label: 'Chat', kind: 'chat', descriptorId: 'chat.thread', material: 'docked' },
  { id: 'index', label: 'Index', kind: 'index', descriptorId: 'index.rail', material: 'sunken' },
  { id: 'data-model', label: 'Data model', kind: 'data-model', descriptorId: 'index.rail', material: 'sunken' },
  { id: 'plan', label: 'Plan', kind: 'plan', descriptorId: 'goal.stack', material: 'sunken' },
  { id: 'records', label: 'Records', kind: 'records', descriptorId: 'record.table', material: 'sunken' },
  { id: 'automation', label: 'Automation', kind: 'automation', descriptorId: 'proactivity.graph', material: 'sunken' },
  { id: 'filing', label: 'Filing', kind: 'filing', descriptorId: 'files.tree', material: 'sunken' },
  { id: 'documents', label: 'Documents', kind: 'documents', descriptorId: 'markdown.doc', material: 'lifted' },
  { id: 'files', label: 'Files', kind: 'files', descriptorId: 'files.tree', material: 'sunken' },
];

const ICONS: Record<string, typeof IconRecords> = {
  chat: IconThread,
  index: IconRail,
  'data-model': IconModel,
  plan: IconModel,
  records: IconRecords,
  automation: IconRail,
  filing: IconDoc,
  documents: IconDoc,
  files: IconWorkspace,
  agent: IconMemory,
};

export interface SidebarProps {
  readonly host: ConsoleBlockHost;
  readonly activeViewId: string;
  readonly dirty: boolean;
  readonly objectTypes?: readonly { readonly name: string; readonly count: number; readonly diverged?: boolean }[];
  readonly pins?: readonly SurfaceViewSummary[];
  /** Navigate to a saved view. Parent autosaves dirty state before routing. */
  readonly onNavigateView: (slug: string) => void | Promise<void>;
  readonly onAddBlock: (item: BlockPaletteItem) => { replaced?: string; message?: string };
  readonly onAddRecordsForType?: (typeName: string) => void;
}

export function Sidebar({
  host,
  activeViewId,
  dirty,
  objectTypes = [],
  pins = [],
  onNavigateView,
  onAddBlock,
  onAddRecordsForType,
}: SidebarProps) {
  const views = useMemo(() => listSavedViews(host), [host, activeViewId, dirty]);
  const [message, setMessage] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [navObjects, setNavObjects] = useState<readonly NavItem[]>([]);

  useEffect(() => {
    let active = true;
    void fetch('/api/navigation', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { items?: NavItem[] }) => {
        if (!active) return;
        const items = Array.isArray(payload.items) ? payload.items : [];
        setNavObjects(items.filter((item) => item.itemKind?.kind === 'object'));
      })
      .catch(() => {
        if (!active) return;
        setNavObjects([]);
      });
    return () => {
      active = false;
    };
  }, [host, objectTypes]);

  const objectRows = useMemo(() => {
    if (navObjects.length > 0) {
      return navObjects.map((item) => ({
        key: item.id,
        label: deriveLabel(item.itemKind),
        typeName: item.itemKind.kind === 'object' ? item.itemKind.objectTypeId : item.id,
        count: 0,
        diverged: false,
      }));
    }
    return objectTypes.map((type) => ({
      key: type.name,
      label: type.name,
      typeName: type.name,
      count: type.count,
      diverged: type.diverged,
    }));
  }, [navObjects, objectTypes]);

  const navigate = async (slug: string) => {
    if (leaving) return;
    setLeaving(true);
    try {
      // Dirty views autosave: the surface object is durable, so leaving writes
      // rather than asking. Spec CS7's confirm is overridden by this choice.
      await onNavigateView(slug);
    } finally {
      setLeaving(false);
    }
  };

  const addBlock = (item: BlockPaletteItem) => {
    const result = onAddBlock(item);
    markViewDirty(activeViewId);
    if (result.message) setMessage(result.message);
    else setMessage(null);
  };

  return (
    <nav
      data-sidebar
      aria-label="Console palette"
      className="flex h-full w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-ij-seam bg-ij-chrome px-2 py-3 text-ij-ink"
    >
      <SidebarGroup title="Views">
        {views.map((view) => (
          <SidebarButton
            key={view.id}
            label={view.name}
            selected={view.id === activeViewId || view.slug === activeViewId}
            href={viewPath(view.slug)}
            onClick={() => void navigate(view.slug)}
            icon={ICONS[view.slug] ?? IconWorkspace}
          />
        ))}
      </SidebarGroup>

      <SidebarGroup title="Blocks">
        {BLOCK_PALETTE.map((item) => (
          <SidebarButton
            key={item.id}
            label={item.label}
            onClick={() => addBlock(item)}
            icon={ICONS[item.kind] ?? IconRecords}
            hint={materialForKind(item.kind)}
          />
        ))}
      </SidebarGroup>

      <SidebarGroup title="Objects">
        {objectRows.length === 0 ? (
          <p className="px-2 text-ij-ink-info">No declared types yet.</p>
        ) : (
          objectRows.map((type) => (
            <SidebarButton
              key={type.key}
              label={type.count > 0 ? `${type.label} (${type.count})` : type.label}
              onClick={() => onAddRecordsForType?.(type.typeName)}
              icon={IconRecords}
              diverged={type.diverged}
            />
          ))
        )}
      </SidebarGroup>

      <SidebarGroup title="Pins">
        {pins.length === 0 ? (
          <p className="px-2 text-ij-ink-info">No pins.</p>
        ) : (
          pins.map((pin) => (
            <SidebarButton
              key={pin.id}
              label={pin.name}
              onClick={() => void navigate(pin.slug)}
              icon={IconWorkspace}
            />
          ))
        )}
      </SidebarGroup>

      {leaving ? (
        <p role="status" className="rounded-[var(--radius-control)] px-2 py-1 text-ij-ink-info">
          Saving view…
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-[var(--radius-control)] bg-ij-selection px-2 py-1 text-ij-ink">
          {message}
        </p>
      ) : null}
    </nav>
  );
}

function SidebarGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <h2 className="px-2 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
        {title}
      </h2>
      <div className="grid gap-0.5">{children}</div>
    </div>
  );
}

function SidebarButton({
  label,
  onClick,
  icon: Icon,
  selected = false,
  hint,
  diverged,
  href,
}: {
  label: string;
  onClick: () => void;
  icon: typeof IconRecords;
  selected?: boolean;
  hint?: string;
  diverged?: boolean;
  href?: string;
}) {
  return (
    <button
      type="button"
      data-nav-icon
      data-href={href}
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      className="flex h-ij-row w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-left text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink aria-[current=page]:bg-ij-selection aria-[current=page]:text-ij-ink"
    >
      <Icon size={16} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? (
        <span className="text-ij-ink-disabled" style={{ fontSize: 'var(--ij-sidebar-hint-size)' }}>
          {hint}
        </span>
      ) : null}
      {diverged ? <span aria-label="diverged" className="size-1.5 rounded-full bg-ij-warn" /> : null}
    </button>
  );
}
