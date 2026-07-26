'use client';

// SOURCING: SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS3 + 1.1 CS14/CS15.
// Three materials only. Shared anatomy: identity row, optional control row,
// body. Material stays a property of block kind.

import type { CSSProperties, ReactNode } from 'react';
import type { Degradation } from '@/lib/degradation';

export type BlockMaterial = 'sunken' | 'lifted' | 'docked';
export type DockEdge = 'left' | 'right' | 'top' | 'bottom';

export interface BlockShellProps {
  readonly material: BlockMaterial;
  readonly dock?: DockEdge;
  readonly collapsed?: boolean;
  readonly collapsedWidth?: number;
  readonly identityHue?: string | null;
  readonly title?: string;
  readonly count?: number | string | null;
  readonly scope?: ReactNode;
  readonly degradation?: Degradation | null;
  /** Optional control row: tabs OR a control bar, never both. */
  readonly controlRow?: ReactNode;
  readonly headerActions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly onToggleCollapse?: () => void;
  /** When false, omit identity row entirely (Indexer reference). */
  readonly showIdentity?: boolean;
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
  count,
  scope,
  degradation = null,
  controlRow,
  headerActions,
  children,
  className = '',
  style,
  onToggleCollapse,
  showIdentity = true,
}: BlockShellProps) {
  const dockedCollapsed = material === 'docked' && collapsed;
  const hasIdentity =
    showIdentity &&
    Boolean(title || identityHue || scope || count != null || degradation?.level === 'reduced' || headerActions || (material === 'docked' && onToggleCollapse));
  const hasControl = Boolean(controlRow);

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
      {hasIdentity ? (
        <header
          data-block-header
          data-block-identity
          className="flex h-ij-row shrink-0 items-center gap-2 border-b border-ij-seam px-2 text-ij-ink"
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
          {title ? (
            <span className="min-w-0 truncate">
              {title}
            </span>
          ) : (
            <span className="flex-1" />
          )}
          {scope ? (
            <span data-block-scope className="min-w-0 truncate text-ij-island-meta text-ij-ink-info">
              {scope}
            </span>
          ) : null}
          {count !== undefined && count !== null && String(count).length > 0 ? (
            <span data-block-count className="shrink-0 font-ij-mono text-ij-island-meta tabular-nums text-ij-ink-info" data-mono-ok>
              {count}
            </span>
          ) : null}
          {degradation?.level === 'reduced' ? (
            <span
              data-degradation="reduced"
              className="min-w-0 truncate text-ij-island-meta text-ij-ink-info"
              style={{ fontFamily: 'var(--cp-font-human)' }}
            >
              {degradation.cause}
            </span>
          ) : null}
          <span className="min-w-0 flex-1" aria-hidden />
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
      ) : null}
      {hasControl && !dockedCollapsed ? (
        <div
          data-block-control-row
          className="flex h-ij-control shrink-0 items-center gap-2 border-b border-ij-seam px-2"
        >
          {controlRow}
        </div>
      ) : null}
      {!dockedCollapsed ? (
        <div data-block-body className="min-h-0 min-w-0 flex-1 overflow-auto">
          {degradation?.level === 'unavailable' ? (
            <div
              data-degradation="unavailable"
              className="flex h-full min-h-0 flex-col items-start justify-center gap-2 px-3"
              style={{ fontFamily: 'var(--cp-font-human)' }}
            >
              <p className="text-ij-ink">{degradation.cause}</p>
              {degradation.action ? (
                <button
                  type="button"
                  onClick={degradation.action.run}
                  className="rounded-ij-arc-underline px-2 text-ij-link hover:bg-ij-hover-surface"
                >
                  {degradation.action.label}
                </button>
              ) : null}
            </div>
          ) : (
            children
          )}
        </div>
      ) : null}
    </section>
  );
}
