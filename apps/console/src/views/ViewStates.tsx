'use client';

// SOURCING: hand-roll. The island state grammar (HANDOFF-CONSOLE-ISLAND-SHELL
// IS3): loading, empty, error, stale, plus unavailable/populated for surface
// mounts that still need them. The shell owns error once: body notice plus
// footer summary. Blocks never hand-roll state rendering.

import type { ReactNode } from 'react';
import { EmptyRegion, type EmptyCause } from '@/components/material/EmptyRegion';

export type ViewStateKind =
  | 'loading'
  | 'empty'
  | 'unavailable'
  | 'error'
  | 'stale'
  | 'populated';

export interface ViewStateProps {
  readonly state: ViewStateKind;
  /** Named missing capability for the unavailable state. */
  readonly capability?: string;
  readonly errorMessage?: string;
  readonly onRetry?: () => void;
  readonly children?: ReactNode;
  /**
   * When `shell`, error renders only the body notice (no message string in the
   * content flow). The footer summary is produced by `viewStateFooterSummary`.
   */
  readonly mode?: 'standalone' | 'shell';
  /** Skeleton shape hint for loading (island body). */
  readonly skeleton?: 'rows' | 'cards' | 'blank';
  /** Designed empty copy (B8). Defaults come from emptyCause. */
  readonly emptyTitle?: string;
  readonly emptyDetail?: string;
  /**
   * Named empty cause (SPEC-MATERIAL-REGISTER D7). Defaults to no-results so
   * filter empties stay distinguishable from not-connected / not-loaded.
   */
  readonly emptyCause?: EmptyCause;
  readonly emptyActionLabel?: string;
}

function StateLine({ children, padded }: { children: ReactNode; padded: boolean }) {
  return (
    <div
      className={`flex h-full items-center justify-center text-ij-ink-info font-ij-ui${padded ? ' p-ij-island-body-pad' : ''}`}
    >
      {children}
    </div>
  );
}

function LoadingSkeleton({
  skeleton,
  padded,
}: {
  skeleton: 'rows' | 'cards' | 'blank';
  padded: boolean;
}) {
  const pad = padded ? ' p-ij-island-body-pad' : '';
  if (skeleton === 'blank') {
    return (
      <div role="status" aria-live="polite" data-view-state="loading" className={`h-full${pad}`}>
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (skeleton === 'cards') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-view-state="loading"
        data-skeleton="cards"
        className={`grid h-full grid-cols-2 gap-2${pad}`}
      >
        <span className="sr-only">Loading</span>
        <div className="h-24 rounded-ij-arc bg-ij-hover-surface" aria-hidden />
        <div className="h-24 rounded-ij-arc bg-ij-hover-surface" aria-hidden />
        <div className="h-24 rounded-ij-arc bg-ij-hover-surface" aria-hidden />
        <div className="h-24 rounded-ij-arc bg-ij-hover-surface" aria-hidden />
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      data-view-state="loading"
      data-skeleton="rows"
      className={`flex h-full flex-col gap-2${pad}`}
    >
      <span className="sr-only">Loading</span>
      <div className="h-ij-row rounded-ij-arc bg-ij-hover-surface" aria-hidden />
      <div className="h-ij-row rounded-ij-arc bg-ij-hover-surface" aria-hidden />
      <div className="h-ij-row w-3/4 rounded-ij-arc bg-ij-hover-surface" aria-hidden />
    </div>
  );
}

/**
 * One-line footer summary for the shell status line. Empty string means hide
 * the footer. Error is the only state that always contributes a summary when
 * a message is present.
 */
export function viewStateFooterSummary(
  state: ViewStateKind,
  errorMessage?: string,
): string {
  if (state === 'error') return errorMessage ?? 'Something failed.';
  if (state === 'stale') return 'Stale';
  if (state === 'loading') return 'Loading';
  return '';
}

/**
 * The states every island and surface descriptor renders. Shell mode keeps
 * error strings out of the content flow so the footer is the sole summary.
 */
export function ViewState({
  state,
  capability,
  errorMessage,
  onRetry,
  children,
  mode = 'standalone',
  skeleton = 'rows',
  emptyTitle,
  emptyDetail,
  emptyCause = 'no-results',
  emptyActionLabel,
}: ViewStateProps) {
  const padded = mode !== 'shell';
  switch (state) {
    case 'loading':
      return <LoadingSkeleton skeleton={skeleton} padded={padded} />;
    case 'empty':
      return (
        <div data-view-state="empty" className="h-full min-h-0">
          <EmptyRegion
            cause={emptyCause}
            title={emptyTitle}
            detail={emptyDetail}
            actionLabel={emptyActionLabel}
            onAction={onRetry}
            className={padded ? 'p-ij-island-body-pad' : ''}
          />
        </div>
      );
    case 'unavailable':
      return (
        <div data-view-state="unavailable" className="h-full min-h-0">
          <EmptyRegion
            cause="not-connected"
            title="Not connected."
            detail={`Cause: ${capability ?? 'the backing capability'} is not configured or unreachable.`}
            actionLabel={emptyActionLabel}
            onAction={onRetry}
            className={padded ? 'p-ij-island-body-pad' : ''}
          />
        </div>
      );
    case 'error':
      if (mode === 'shell') {
        // Body notice only. The error string lives in the footer summary once.
        return (
          <div
            data-view-state="error"
            data-error-placement="body"
            className="flex h-full flex-col items-start justify-center gap-3"
          >
            <p className="text-ij-island-section font-ij-ui text-ij-error" style={{ fontWeight: 600 }}>
              Something went wrong
            </p>
            <p className="text-ij-ink-info font-ij-ui">
              The query failed. Use the status line action when available.
            </p>
          </div>
        );
      }
      return (
        <StateLine padded={padded}>
          <span className="text-ij-error">{errorMessage ?? 'Something failed.'}</span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="ml-3 h-ij-control rounded-ij-arc bg-ij-accent px-4 text-ij-ink-bright hover:bg-ij-accent-hover"
            >
              Retry
            </button>
          ) : null}
        </StateLine>
      );
    case 'stale':
      return (
        <div className="relative h-full opacity-75" data-view-state="stale">
          {children}
        </div>
      );
    case 'populated':
    default:
      return <div className="h-full" data-view-state="populated">{children}</div>;
  }
}
