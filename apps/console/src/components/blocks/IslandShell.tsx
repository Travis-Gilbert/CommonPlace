'use client';

// SOURCING: hand-roll (IslandShell). HANDOFF-CONSOLE-ISLAND-SHELL IS1: the one
// island chrome. Blocks bring content; this shell brings composition. Paint is
// transparent so the Material Layer owns base, lit edge, grain, and gutter
// shadow. Anatomy: header band, flat body, footer status.

import { useDraggable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import type {
  BlockDensity,
  IslandBodyBleed,
  IslandSurfaceClass,
  ViewDescriptor,
} from '@commonplace/block-view/types';
import { resolveIslandSurfaceClass } from '@commonplace/block-view/island-class';
import { kindGlyphNode } from '@/components/blocks/kind-glyph';
import { IconHide } from '@/components/shell/icons';
import { sizesFailingHeaderFit } from '@/lib/island-grid';
import { ViewState, viewStateFooterSummary, type ViewStateKind } from '@/views/ViewStates';

export interface IslandShellProps {
  readonly descriptor: ViewDescriptor;
  /** The block-view `view-instance` object id. */
  readonly viewInstanceId: string;
  readonly children?: ReactNode;
  readonly state?: ViewStateKind;
  readonly errorMessage?: string;
  readonly onRetry?: () => void;
  readonly count?: number | string;
  /** Live transport / receipt notes for the footer (non-error). */
  readonly statusNote?: string;
  readonly live?: boolean;
  readonly actions?: ReactNode;
  readonly onHide?: () => void;
  /** Override density when descriptor.block.density is `both`. */
  readonly density?: Exclude<BlockDensity, 'both'>;
  /** Override surface class; defaults from descriptor.block.surfaceClass. */
  readonly surfaceClass?: IslandSurfaceClass;
  /** Override kind glyph node; defaults from descriptor.block.kindGlyph. */
  readonly kindGlyph?: ReactNode;
  /** Override body bleed; defaults from descriptor.block.bodyBleed. */
  readonly bodyBleed?: IslandBodyBleed;
  readonly title?: string;
  /** When false, omit the dnd-kit drag handle (e.g. fixed tool windows). */
  readonly draggable?: boolean;
  readonly skeleton?: 'rows' | 'cards' | 'blank';
  readonly emptyTitle?: string;
  readonly emptyDetail?: string;
}

function resolveDensity(
  descriptor: ViewDescriptor,
  override?: Exclude<BlockDensity, 'both'>,
): Exclude<BlockDensity, 'both'> {
  if (override) return override;
  const declared = descriptor.block?.density ?? 'cozy';
  if (declared === 'both' || declared === 'cozy') return 'cozy';
  return 'compact';
}

function resolveBodyBleed(
  descriptor: ViewDescriptor,
  override?: IslandBodyBleed,
): IslandBodyBleed {
  return override ?? descriptor.block?.bodyBleed ?? 'inset';
}

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `island:${id}`,
    data: { viewInstanceId: id },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-island-drag-handle
      aria-label="Drag island"
      title="Drag island"
      {...listeners}
      {...attributes}
      className="flex size-5 shrink-0 items-center justify-center rounded-ij-arc-underline text-ij-ink-info opacity-0 hover:bg-ij-hover-surface hover:text-ij-ink focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
      style={{ opacity: isDragging ? 1 : undefined, cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="stroke-current">
        <circle cx="5" cy="4" r="1" fill="currentColor" stroke="none" />
        <circle cx="11" cy="4" r="1" fill="currentColor" stroke="none" />
        <circle cx="5" cy="8" r="1" fill="currentColor" stroke="none" />
        <circle cx="11" cy="8" r="1" fill="currentColor" stroke="none" />
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="11" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}

/**
 * The one island chrome. Every island-mounted block renders inside this shell.
 * Do not draw container radius, border, or shadow on the block content.
 */
export function IslandShell({
  descriptor,
  viewInstanceId,
  children,
  state = 'populated',
  errorMessage,
  onRetry,
  count,
  statusNote,
  live = false,
  actions,
  onHide,
  density: densityOverride,
  surfaceClass: surfaceOverride,
  kindGlyph: kindGlyphOverride,
  bodyBleed: bodyBleedOverride,
  title,
  draggable = true,
  skeleton,
  emptyTitle,
  emptyDetail,
}: IslandShellProps) {
  const density = resolveDensity(descriptor, densityOverride);
  const surfaceClass = surfaceOverride ?? resolveIslandSurfaceClass(descriptor.block?.surfaceClass);
  const bodyBleed = resolveBodyBleed(descriptor, bodyBleedOverride);
  const glyph = kindGlyphOverride ?? kindGlyphNode(descriptor.block?.kindGlyph);
  const sizes = descriptor.block?.sizes ?? [];

  if (process.env.NODE_ENV !== 'production' && sizes.length > 0) {
    const failing = sizesFailingHeaderFit(sizes);
    if (failing.length > 0) {
      console.error(
        `[IslandShell] descriptor ${descriptor.id} declares sizes that cannot fit the header: ${failing.join(', ')}`,
      );
    }
  }

  const headerTitle = title ?? descriptor.name;
  const footerFromState = viewStateFooterSummary(state, errorMessage);
  const footerText = footerFromState || statusNote || '';
  const showFooter = footerText.length > 0 || live;

  const body =
    state === 'populated' || state === 'stale' ? (
      <ViewState state={state} mode="shell">
        {children}
      </ViewState>
    ) : (
      <ViewState
        state={state}
        mode="shell"
        errorMessage={errorMessage}
        onRetry={onRetry}
        skeleton={skeleton}
        emptyTitle={emptyTitle}
        emptyDetail={emptyDetail}
      />
    );

  return (
    <section
      data-island={surfaceClass}
      data-island-shell
      data-island-density={density}
      data-island-bleed={bodyBleed}
      data-view-instance={viewInstanceId}
      data-descriptor={descriptor.id}
      data-paint-region="island-shell"
      aria-label={headerTitle}
      className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-ij-island bg-transparent"
    >
      <header
        data-island-header
        data-paint-region="island-header"
        className="flex h-ij-island-header shrink-0 items-center gap-2 border-b border-ij-seam bg-transparent px-3 text-ij-ink"
      >
        <span
          data-island-kind-glyph
          className="flex size-4 shrink-0 items-center justify-center text-ij-ink-info"
          aria-hidden
        >
          {glyph}
        </span>
        <h2
          data-island-title
          className="min-w-0 truncate font-ij-ui text-ij-island-title text-ij-ink"
          style={{ fontWeight: 600 }}
        >
          {headerTitle}
        </h2>
        {count !== undefined && count !== null && String(count).length > 0 ? (
          <span
            data-island-count
            className="shrink-0 font-ij-mono text-ij-island-meta tabular-nums text-ij-ink-info"
          >
            {count}
          </span>
        ) : null}
        <span className="min-w-0 flex-1" aria-hidden />
        {actions ? (
          <div data-island-actions className="flex shrink-0 items-center gap-1">
            {actions}
          </div>
        ) : null}
        {onHide ? (
          <button
            type="button"
            data-island-hide
            aria-label={`Hide ${headerTitle}`}
            title={`Hide ${headerTitle}`}
            onClick={onHide}
            className="flex size-5 shrink-0 items-center justify-center rounded-ij-arc-underline text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
          >
            <IconHide size={14} />
          </button>
        ) : null}
        {draggable ? <DragHandle id={viewInstanceId} /> : null}
      </header>

      <div
        data-island-body
        className={
          bodyBleed === 'flush'
            ? 'min-h-0 flex-1 overflow-auto p-0'
            : 'min-h-0 flex-1 overflow-auto p-ij-island-body-pad'
        }
      >
        {body}
      </div>

      {showFooter ? (
        <footer
          data-island-footer
          data-paint-region="island-footer"
          className="flex h-ij-island-footer shrink-0 items-center gap-2 border-t border-ij-seam bg-transparent px-3 font-ij-mono text-ij-island-meta text-ij-ink-info"
        >
          {live ? (
            <span
              data-island-live-dot
              className="size-1.5 shrink-0 rounded-ij-arc-underline bg-ij-running"
              aria-label="Live"
              title="Live"
            />
          ) : null}
          <span data-island-footer-text className="min-w-0 truncate tabular-nums">
            {footerText}
          </span>
          {state === 'error' && onRetry ? (
            <button
              type="button"
              data-island-footer-retry
              onClick={onRetry}
              className="ml-auto shrink-0 text-ij-accent hover:text-ij-accent-hover"
            >
              Retry
            </button>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
