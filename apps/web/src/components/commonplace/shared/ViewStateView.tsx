'use client';

/**
 * ViewStateView renders a five-state ViewState (SPEC-UX-PHYSICS D4) and refines
 * its loading branch through the wait-tier ladder (HANDOFF-WAIT-LADDER D1):
 *
 *   empty    designed empty slot (honest, never a populated-looking fake)
 *   loading  T0 nothing, T1 skeleton slot, T2 WeaveSpinner plus one narrated line,
 *            T3 the same spinner today (WL-3 upgrades T3 to a backgroundable job card)
 *   partial  the data that already arrived, while the rest streams
 *   error    designed error with an optional retry
 *   success  the full data
 *
 * The children render prop receives (data, partial) so a surface can subtly mark
 * that more is still streaming without a second code path.
 */

import type { CSSProperties, ReactNode } from 'react';
import type { ViewState } from '@/lib/commonplace-view-state';
import { useWaitTier } from '@/lib/commonplace-wait-tier';
import { WeaveSpinner } from '@/components/WeaveSpinner';

export interface ViewStateViewProps<T> {
  readonly state: ViewState<T>;
  /** Known-shape skeleton for the T1 micro-state. Falls back to a plain block. */
  readonly skeleton?: ReactNode;
  /** Designed empty state. Falls back to a quiet honest line. */
  readonly empty?: ReactNode;
  /** One line of narrated intent for the T2/T3 spinner (pull from the WL-2 inventory). */
  readonly narration?: string;
  /** Accessible label for the operation (aria + fallback empty copy). */
  readonly label?: string;
  /** Epoch ms the operation began, when it started before this mounted. */
  readonly startedAt?: number;
  readonly children: (data: T, partial: boolean) => ReactNode;
}

const centered: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: '24px 16px',
  color: 'var(--cp-text-muted)',
  fontFamily: 'var(--cp-font-body)',
  fontSize: 13,
  textAlign: 'center',
};

function DefaultSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 44,
            borderRadius: 6,
            background:
              'linear-gradient(90deg, var(--cp-skeleton-base) 25%, var(--cp-skeleton-shine) 50%, var(--cp-skeleton-base) 75%)',
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  );
}

export function ViewStateView<T>({
  state,
  skeleton,
  empty,
  narration,
  label = 'Loading',
  startedAt,
  children,
}: ViewStateViewProps<T>) {
  // Hook called unconditionally; it stays at T0 unless the state is loading.
  const tier = useWaitTier(state.status === 'loading', startedAt);

  if (state.status === 'empty') {
    return (
      <>{empty ?? <div style={centered}>{`No ${label.toLowerCase()} yet.`}</div>}</>
    );
  }

  if (state.status === 'error') {
    return (
      <div style={centered} role="alert">
        <div style={{ color: 'var(--cp-text)' }}>{state.message}</div>
        {state.retry ? (
          <button
            type="button"
            onClick={state.retry}
            style={{
              border: '1px solid var(--cp-accent)',
              background: 'var(--cp-accent)',
              color: 'var(--cp-cream)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (state.status === 'loading') {
    if (tier === 'T0') return null;
    if (tier === 'T1') return <>{skeleton ?? <DefaultSkeleton />}</>;
    // T2 and T3: WeaveSpinner plus one narrated line. WL-3 upgrades T3 to a
    // backgroundable job card streaming real harness_step events.
    return (
      <div style={centered} role="status" aria-label={label}>
        <WeaveSpinner size="compact" />
        {narration ? <div>{narration}</div> : null}
      </div>
    );
  }

  // partial or success: render the data, flagging whether more is still streaming.
  return <>{children(state.data, state.status === 'partial')}</>;
}

export default ViewStateView;
