'use client';

// SOURCING: hand-roll. The five-state view scaffold is the spec's own wait
// ladder pattern (loading, empty, unavailable naming the missing capability,
// error with retry, stale, populated); no library models this contract.

import type { ReactNode } from 'react';

export type ViewStateKind = 'loading' | 'empty' | 'unavailable' | 'error' | 'stale' | 'populated';

export interface ViewStateProps {
  readonly state: ViewStateKind;
  /** Named missing capability for the unavailable state. */
  readonly capability?: string;
  readonly errorMessage?: string;
  readonly onRetry?: () => void;
  readonly children?: ReactNode;
}

function StateLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-ij-ink-info font-ij-ui">
      {children}
    </div>
  );
}

/**
 * The five states every descriptor renders (G6). `stale` renders children
 * dimmed with a marker; `populated` renders children plainly.
 */
export function ViewState({ state, capability, errorMessage, onRetry, children }: ViewStateProps) {
  switch (state) {
    case 'loading':
      return (
        <StateLine>
          <span role="status" aria-live="polite">Loading&hellip;</span>
        </StateLine>
      );
    case 'empty':
      return <StateLine>No records match.</StateLine>;
    case 'unavailable':
      return (
        <StateLine>
          <span>
            Unavailable: {capability ?? 'the backing capability'} is not configured.
          </span>
        </StateLine>
      );
    case 'error':
      return (
        <StateLine>
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
