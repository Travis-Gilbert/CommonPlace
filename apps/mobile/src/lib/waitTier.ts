/**
 * Wait-tier ladder (HANDOFF-WAIT-LADDER D1), mobile mirror of
 * apps/web/src/lib/commonplace-wait-tier.ts. One wait-state system for every
 * surface: given an operation kind and elapsed time it yields the active tier,
 * promoting T0 to T1 to T2 to T3 as time passes rather than requiring the caller
 * to predict duration. It composes with the five-state view union (./viewState);
 * it refines the `loading` branch, it does not replace it.
 *
 *   T0  under 300ms   render nothing (an indicator inside 300ms feels slower).
 *   T1  300ms to 2s   micro-state: skeleton for known shape.
 *   T2  2s to 10s     WeaveSpinner plus one line of narrated intent.
 *   T3  beyond 10s    convert to a backgroundable job (WL-3). A naked spinner past
 *                     ten seconds is a defect.
 *
 * Same bounds, same promotion behavior as the web copy.
 */

import { useEffect, useRef, useState } from 'react';

export type WaitTier = 'T0' | 'T1' | 'T2' | 'T3';

/** Tier boundaries in milliseconds. */
export const WAIT_TIER_BOUNDS = { t1: 300, t2: 2000, t3: 10000 } as const;

/** Pure map from elapsed milliseconds to the active tier. */
export function tierForElapsed(elapsedMs: number): WaitTier {
  if (elapsedMs < WAIT_TIER_BOUNDS.t1) return 'T0';
  if (elapsedMs < WAIT_TIER_BOUNDS.t2) return 'T1';
  if (elapsedMs < WAIT_TIER_BOUNDS.t3) return 'T2';
  return 'T3';
}

/**
 * Track the wait tier for an in-flight operation, promoting the tier as time
 * passes. Returns 'T0' whenever `active` is false. Timers are scheduled exactly
 * at each remaining boundary, so this never busy-polls. Pass `startedAt` (an
 * epoch ms) when the operation began before this component mounted (for example
 * a durable run resumed on cold launch), so the tier reflects true elapsed time.
 */
export function useWaitTier(active: boolean, startedAt?: number): WaitTier {
  const [tier, setTier] = useState<WaitTier>('T0');
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      setTier('T0');
      return;
    }

    const start = startedAt ?? Date.now();
    startRef.current = start;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const scheduleBoundary = (boundMs: number, next: WaitTier) => {
      const delay = boundMs - (Date.now() - start);
      if (delay <= 0) {
        setTier(next);
        return;
      }
      timers.push(setTimeout(() => setTier(next), delay));
    };

    setTier(tierForElapsed(Date.now() - start));
    scheduleBoundary(WAIT_TIER_BOUNDS.t1, 'T1');
    scheduleBoundary(WAIT_TIER_BOUNDS.t2, 'T2');
    scheduleBoundary(WAIT_TIER_BOUNDS.t3, 'T3');

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [active, startedAt]);

  return tier;
}
