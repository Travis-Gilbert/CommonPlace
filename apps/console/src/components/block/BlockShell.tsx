'use client';

// SOURCING: SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS3.
// Three materials only. The material is a property of the block kind, not a
// per-instance choice. Sunken / lifted / docked.

import type { CSSProperties, ReactNode } from 'react';

export type BlockMaterial = 'sunken' | 'lifted' | 'docked';
export type DockEdge = 'left' | 'right' | 'top' | 'bottom';

export interface BlockShellProps {
  readonly material: BlockMaterial;
  readonly dock?: DockEdge;
  readonly collapsed?: boolean;
  readonly collapsedWidth?: number;
  readonly identityHue?: string | null;
  readonly title?: string;
  readonly headerActions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly onToggleCollapse?: () => void;
}

/** Kind → material. Spec CS3. */
export const MATERIAL_BY_KIND: Readonly<Record<string, BlockMaterial>> = {
  'data-model': 'sunken',
  plan: 'sunken',
  records: 'sunken',
  index: 'sunken',
  filing: 'sunken',
  document: 'lifted',
  documents: 'lifted',
  reader: 'lifted',
  preview: 'lifted',
  chat: 'docked',
  agent: 'docked',
  'agent-rail': 'docked',
};

export function materialForKind(kind: string): BlockMaterial {
  return MATERIAL_BY_KIND[kind] ?? 'sunken';
}

const COLLAPSED_STUB = 32;

export function BlockShell({
  material,
  dock = 'right',
  collapsed = false,
  collapsedWidth = COLLAPSED_STUB,
  identityHue = null,
  title,
  headerActions,
  children,
  className = '',
  style,
  onToggleCollapse,
}: BlockShellProps) {
  const dockedCollapsed = material === 'docked' && collapsed;

  return (
    <section
      data-block-shell
      data-material={material}
      data-dock={material === 'docked' ? dock : undefined}
      data-collapsed={dockedCollapsed ? 'true' : undefined}
      className={`relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${className}`}
      style={{
        width: dockedCollapsed ? collapsedWidth : undefined,
        ...style,
      }}
    >
      {(title || identityHue || headerActions || (material === 'docked' && onToggleCollapse)) && (
        <header
          data-block-header
          className="flex h-ij-toolwindow-header shrink-0 items-center gap-2 border-b border-ij-seam px-2 text-ij-ink"
          style={{ fontWeight: 'var(--rec-weight-cap)' }}
        >
          {identityHue ? (
            <span
              data-identity-chip
              aria-hidden="true"
              className="inline-block size-2.5 shrink-0"
              style={{
                background: identityHue,
                borderRadius: 2,
              }}
            />
          ) : null}
          {title ? <span className="min-w-0 flex-1 truncate">{title}</span> : <span className="flex-1" />}
          {headerActions}
          {material === 'docked' && onToggleCollapse ? (
            <button
              type="button"
              data-dock-collapse
              aria-label={collapsed ? 'Expand rail' : 'Collapse rail'}
              aria-expanded={!collapsed}
              onClick={onToggleCollapse}
              className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-chip)] text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
            >
              {collapsed ? '‹' : '›'}
            </button>
          ) : null}
        </header>
      )}
      {!dockedCollapsed ? (
        <div data-block-body className="min-h-0 min-w-0 flex-1 overflow-auto">
          {children}
        </div>
      ) : null}
    </section>
  );
}
