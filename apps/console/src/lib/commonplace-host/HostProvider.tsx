// SOURCING: @commonplace/host-bridge (CommonplaceHost) — React context so the
// console surface never imports a transport adapter directly.

'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  CommonplaceHost,
  ObjectQuery,
  ObjectSet,
  OpenTarget,
} from '@commonplace/host-bridge';
import { createHost, type HostKind } from './createHost';

const HostContext = createContext<CommonplaceHost | null>(null);

export interface HostProviderProps {
  children: ReactNode;
  kind?: HostKind;
  workspaceId?: string;
  queryObjects?: (q: ObjectQuery) => Promise<ObjectSet>;
  onOpenTarget?: (t: OpenTarget) => void | Promise<void>;
  /** Inject a host in tests. */
  host?: CommonplaceHost;
}

export function HostProvider({
  children,
  kind,
  workspaceId = 'default',
  queryObjects,
  onOpenTarget,
  host: injected,
}: HostProviderProps) {
  const host = useMemo(
    () =>
      injected ??
      createHost({ kind, workspaceId, queryObjects, onOpenTarget }),
    // Intentionally stable for the session; recreate only when kind changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [injected, kind],
  );

  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

export function useHost(): CommonplaceHost {
  const host = useContext(HostContext);
  if (!host) {
    throw new Error('useHost requires HostProvider');
  }
  return host;
}

/** Soft accessor for optional chrome that may render outside the shell. */
export function useOptionalHost(): CommonplaceHost | null {
  return useContext(HostContext);
}
