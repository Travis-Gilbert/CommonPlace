'use client';

// SOURCING: hand-roll (BlockShell). The one block chrome. Blocks bring content;
// this shell brings composition. Paint is
// transparent so the Material Layer owns base, lit edge, grain, and gutter
// shadow. Anatomy: header band, flat body, footer status.

import { useDraggable } from '@dnd-kit/core';
import type { HTMLAttributes, ReactNode } from 'react';
import type {
  BlockDensity,
  BlockBodyBleed,
  BlockSurfaceClass,
  ViewDescriptor,
} from '@commonplace/block-view/types';
import { resolveBlockSurfaceClass } from '@commonplace/block-view';
import { kindGlyphNode } from '@/components/blocks/kind-glyph';
import { IconHide } from '@/components/shell/icons';
import { sizesFailingHeaderFit } from '@/lib/block-geometry';
import { ViewState, viewStateFooterSummary, type ViewStateKind } from '@/views/ViewStates';

export interface BlockShellProps {
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
  readonly surfaceClass?: BlockSurfaceClass;
  /** Override kind glyph node; defaults from descriptor.block.kindGlyph. */
  readonly kindGlyph?: ReactNode;
  /** Override body bleed; defaults from descriptor.block.bodyBleed. */
  readonly bodyBleed?: BlockBodyBleed;
  readonly title?: string;
  /** When false, omit the dnd-kit drag handle (e.g. fixed tool windows). */
  readonly draggable?: boolean;
  /** Whole-header drag: sortable listeners from BlockCanvas (OB6). */
  readonly headerDragRef?: (node: HTMLElement | null) => void;
  readonly headerDragListeners?: HTMLAttributes<HTMLElement>;
  readonly headerDragAttributes?: HTMLAttributes<HTMLElement>;
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
  override?: BlockBodyBleed,
): BlockBodyBleed {
  return override ?? descriptor.block?.bodyBleed ?? 'inset';
}

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${id}`,
    data: { viewInstanceId: id },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-block-drag-handle
      aria-label="Drag block"
      title="Drag block"
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
 * The one block chrome. Every ground block renders inside this shell.
 * Do not draw container radius, border, or shadow on the block content.
 */
export function BlockShell({
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
  headerDragRef,
  headerDragListeners,
  headerDragAttributes,
  skeleton,
  emptyTitle,
  emptyDetail,
}: BlockShellProps) {
  const density = resolveDensity(descriptor, densityOverride);
  const surfaceClass = surfaceOverride ?? resolveBlockSurfaceClass(descriptor.block?.surfaceClass);
  const bodyBleed = resolveBodyBleed(descriptor, bodyBleedOverride);
  const glyph = kindGlyphOverride ?? kindGlyphNode(descriptor.block?.kindGlyph);
  const declaredSizes = descriptor.block ? [descriptor.block.defaultSize] : [];

  if (process.env.NODE_ENV !== 'production' && declaredSizes.length > 0) {
    const failing = sizesFailingHeaderFit(declaredSizes);
    if (failing.length > 0) {
      console.error(
        `[BlockShell] descriptor ${descriptor.id} declares sizes that cannot fit the header: ${failing.join(', ')}`,
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
      data-block-shell
      data-block-density={density}
      data-block-bleed={bodyBleed}
      data-view-instance={viewInstanceId}
      data-descriptor={descriptor.id}
      data-paint-region="island-shell"
      aria-label={headerTitle}
      className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-ij-island bg-transparent"
    >
      <header
        ref={headerDragRef}
        data-island-header
        data-paint-region="island-header"
        data-block-drag-surface={headerDragListeners ? 'true' : undefined}
        className="flex h-ij-island-header shrink-0 items-center gap-2 border-b border-ij-seam px-3 text-ij-ink"
        style={headerDragListeners ? { cursor: 'grab', touchAction: 'none' } : undefined}
        {...(headerDragAttributes ?? {})}
        {...(headerDragListeners ?? {})}
      >
        <span
          data-block-kind-glyph
          className="flex size-4 shrink-0 items-center justify-center text-ij-ink-info"
          aria-hidden
        >
          {glyph}
        </span>
        <h2
          data-block-title
          className="min-w-0 truncate font-ij-ui text-ij-island-title text-ij-ink"
          style={{ fontWeight: 600 }}
        >
          {headerTitle}
        </h2>
        {count !== undefined && count !== null && String(count).length > 0 ? (
          <span
            data-block-count
            className="shrink-0 font-ij-mono text-ij-island-meta tabular-nums text-ij-ink-info"
          >
            {count}
          </span>
        ) : null}
        <span className="min-w-0 flex-1" aria-hidden />
        {actions ? (
          <div
            data-block-actions
            className="flex shrink-0 items-center gap-1"
            onPointerDown={(event) => event.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
        {onHide ? (
          <button
            type="button"
            data-block-hide
            aria-label={`Hide ${headerTitle}`}
            title={`Hide ${headerTitle}`}
            onClick={onHide}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex size-5 shrink-0 items-center justify-center rounded-ij-arc-underline text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
          >
            <IconHide size={14} />
          </button>
        ) : null}
        {draggable && !headerDragListeners ? <DragHandle id={viewInstanceId} /> : null}
        {headerDragListeners ? (
          <button
            type="button"
            data-block-drag-handle
            aria-label="Drag block"
            title="Drag block"
            className="flex size-5 shrink-0 items-center justify-center rounded-ij-arc-underline text-ij-ink-info opacity-0 hover:bg-ij-hover-surface hover:text-ij-ink focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
            style={{ cursor: 'grab' }}
          >
            ⠿
          </button>
        ) : null}
      </header>

      <div
        data-block-body
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
          data-block-footer
          data-paint-region="island-footer"
          className="flex h-ij-island-footer shrink-0 items-center gap-2 border-t border-ij-seam bg-transparent px-3 font-ij-mono text-ij-island-meta text-ij-ink-info"
        >
          {live ? (
            <span
              data-block-live-dot
              className="size-1.5 shrink-0 rounded-ij-arc-underline bg-ij-running"
              aria-label="Live"
              title="Live"
            />
          ) : null}
          <span data-block-footer-text className="min-w-0 truncate tabular-nums">
            {footerText}
          </span>
          {state === 'error' && onRetry ? (
            <button
              type="button"
              data-block-footer-retry
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
