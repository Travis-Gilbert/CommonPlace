'use client';

// SOURCING: none. Same-origin fetch helpers for the Index surface. There is no
// GraphQL client in this app by design (console-host.ts wraps HttpBlockHost
// over plain fetch), so these mirror that: typed calls against the app's own
// /api/filing routes, never against the harness.

import { useCallback, useEffect, useState } from 'react';
import type {
  DigestGroup,
  FiledItem,
  FilingReceipt,
  FilingRule,
  IndexCollection,
  UrgentEvent,
} from '@/lib/filing/types';

export type FilingFetchState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'unavailable'; readonly capability: string }
  | { readonly status: 'error'; readonly message: string };

/** The capability an unconfigured or unreachable filing engine is missing.
 *  Named, so the surface's unavailable state says the true thing rather than a
 *  generic apology. */
export const FILING_CAPABILITY = 'the filing engine (set CONSOLE_HARNESS_URL)';

async function readJson<T>(url: string): Promise<FilingFetchState<T>> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.status === 404) {
      return { status: 'unavailable', capability: FILING_CAPABILITY };
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = typeof payload?.error === 'string' ? payload.error : 'filing_request_failed';
      if (error === 'filing_graphql_unconfigured') {
        return { status: 'unavailable', capability: FILING_CAPABILITY };
      }
      return { status: 'error', message: error };
    }
    return { status: 'ready', data: payload as T };
  } catch {
    return { status: 'error', message: 'filing_unreachable' };
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'filing_request_failed');
  }
  return payload as T;
}

export interface IndexProjection {
  readonly collections: readonly IndexCollection[];
  readonly recentlyFiled: readonly FiledItem[];
  readonly sinceMs: number;
}

/** One read, shared by the shelves rail and the ribbon, so the two cannot
 *  disagree about what is filed where. */
export function useFilingIndex(): {
  readonly state: FilingFetchState<IndexProjection>;
  readonly refresh: () => void;
} {
  const [state, setState] = useState<FilingFetchState<IndexProjection>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    void readJson<IndexProjection>('/api/filing').then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [nonce]);

  return { state, refresh: useCallback(() => setNonce((value) => value + 1), []) };
}

export function useFilingDigest(): FilingFetchState<{ readonly groups: readonly DigestGroup[] }> {
  const [state, setState] = useState<
    FilingFetchState<{ readonly groups: readonly DigestGroup[] }>
  >({ status: 'loading' });
  useEffect(() => {
    let live = true;
    void readJson<{ readonly groups: readonly DigestGroup[] }>('/api/filing/digest').then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function useFilingRules(): {
  readonly state: FilingFetchState<{ readonly rules: readonly FilingRule[] }>;
  readonly refresh: () => void;
} {
  const [state, setState] = useState<FilingFetchState<{ readonly rules: readonly FilingRule[] }>>({
    status: 'loading',
  });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    void readJson<{ readonly rules: readonly FilingRule[] }>('/api/filing/rules').then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [nonce]);
  return { state, refresh: useCallback(() => setNonce((value) => value + 1), []) };
}

export function useUrgentEvents(): FilingFetchState<{ readonly events: readonly UrgentEvent[] }> {
  const [state, setState] = useState<FilingFetchState<{ readonly events: readonly UrgentEvent[] }>>(
    { status: 'loading' },
  );
  useEffect(() => {
    let live = true;
    void readJson<{ readonly events: readonly UrgentEvent[] }>('/api/filing/urgent').then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function correctFiling(item: string, to: string): Promise<{ receipt: FilingReceipt }> {
  return postJson('/api/filing', { kind: 'correct', item, to });
}

export function undoFiling(item: string): Promise<{ receipt: FilingReceipt }> {
  return postJson('/api/filing', { kind: 'undo', item });
}

export function consentRule(id: string): Promise<{ rule: FilingRule }> {
  return postJson('/api/filing/rules', { kind: 'consent', id });
}

export function denyRule(id: string): Promise<{ denied: string }> {
  return postJson('/api/filing/rules', { kind: 'deny', id });
}

export function deleteRule(id: string): Promise<{ deleted: string }> {
  return postJson('/api/filing/rules', { kind: 'delete', id });
}

export function putRule(rule: {
  readonly id?: string;
  readonly predicates: ReadonlyArray<{ readonly kind: string; readonly value: string }>;
  readonly destination: string;
  readonly urgent: boolean;
}): Promise<{ rule: FilingRule }> {
  return postJson('/api/filing/rules', { kind: 'put', ...rule });
}
