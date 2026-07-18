'use client';

import { useEffect, useState } from 'react';

import { getBundle, getCount, subscribeBundle, type SessionBundle } from './bundle-store';
import { getRailEntries, subscribeRail, type SessionRailEntry } from './session-rail';

/**
 * Live item count for a session's bundle (HANDOFF-CARRY C1.3). Re-reads on every
 * append so the session chrome count updates without polling. Returns 0 for a
 * null session or an empty bundle, which keeps the Carry affordance quiet until
 * the bundle is non-empty.
 */
export function useBundleCount(sessionId: string | null): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!sessionId) {
      setCount(0);
      return;
    }
    let alive = true;
    const refresh = () => {
      void getCount(sessionId).then((next) => {
        if (alive) setCount(next);
      });
    };
    refresh();
    const unsubscribe = subscribeBundle(sessionId, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [sessionId]);
  return count;
}

/** Live bundle for a session, re-read on every append. Undefined until it has
 *  a first item (or an ancestor link). Drives the destinations and the rail. */
export function useBundle(sessionId: string | null): SessionBundle | undefined {
  const [bundle, setBundle] = useState<SessionBundle | undefined>(undefined);
  useEffect(() => {
    if (!sessionId) {
      setBundle(undefined);
      return;
    }
    let alive = true;
    const refresh = () => {
      void getBundle(sessionId).then((next) => {
        if (alive) setBundle(next);
      });
    };
    refresh();
    const unsubscribe = subscribeBundle(sessionId, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [sessionId]);
  return bundle;
}

/** Live session rail entries in order (HANDOFF-CARRY C5.1). Re-reads on every
 *  appended entry so the rail updates as browse, carry, publish, and destination
 *  events land, and travels because it is keyed by session id. */
export function useSessionRail(sessionId: string | null): SessionRailEntry[] {
  const [entries, setEntries] = useState<SessionRailEntry[]>([]);
  useEffect(() => {
    if (!sessionId) {
      setEntries([]);
      return;
    }
    let alive = true;
    const refresh = () => {
      void getRailEntries(sessionId).then((next) => {
        if (alive) setEntries(next);
      });
    };
    refresh();
    const unsubscribe = subscribeRail(sessionId, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [sessionId]);
  return entries;
}
