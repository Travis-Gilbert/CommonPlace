'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getIdentitySession, IdentityClientError } from './client';
import type { IdentitySession } from './contracts';

export type IdentitySessionState =
  | { readonly status: 'auth-loading' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly session: IdentitySession }
  | { readonly status: 'error'; readonly code: string; readonly message: string };

export function useIdentitySession(): {
  readonly state: IdentitySessionState;
  readonly refresh: () => Promise<void>;
} {
  const authSession = useSession();
  const sessionKey = authSession.data?.user?.harnessIdentity ?? null;
  const [resolved, setResolved] = useState<
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly key: string; readonly session: IdentitySession }
    | { readonly status: 'error'; readonly key: string; readonly code: string; readonly message: string }
  >({ status: 'loading' });
  const requestIdRef = useRef(0);

  const loadIdentitySession = useCallback(async (key: string) => {
    const requestId = ++requestIdRef.current;
    try {
      const session = await getIdentitySession();
      if (requestIdRef.current !== requestId) return;
      setResolved({
        status: 'ready',
        key,
        session,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setResolved({
        status: 'error',
        key,
        code: error instanceof IdentityClientError ? error.code : 'identity_request_failed',
        message: error instanceof Error ? error.message : 'The identity request failed',
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    if (authSession.status !== 'authenticated' || !sessionKey) return;
    await loadIdentitySession(sessionKey);
  }, [authSession.status, loadIdentitySession, sessionKey]);

  useEffect(() => {
    if (authSession.status !== 'authenticated' || !sessionKey) return;
    const requestId = ++requestIdRef.current;
    void getIdentitySession().then(
      (session) => {
        if (requestIdRef.current !== requestId) return;
        setResolved({ status: 'ready', key: sessionKey, session });
      },
      (error: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setResolved({
          status: 'error',
          key: sessionKey,
          code: error instanceof IdentityClientError
            ? error.code
            : 'identity_request_failed',
          message: error instanceof Error
            ? error.message
            : 'The identity request failed',
        });
      },
    );
    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current += 1;
      }
    };
  }, [authSession.status, sessionKey]);

  const state: IdentitySessionState =
    authSession.status === 'loading'
      ? { status: 'auth-loading' }
      : authSession.status === 'unauthenticated' || !sessionKey
        ? { status: 'signed-out' }
        : resolved.status === 'loading' || resolved.key !== sessionKey
          ? { status: 'loading' }
          : resolved.status === 'ready'
            ? { status: 'ready', session: resolved.session }
            : {
                status: 'error',
                code: resolved.code,
                message: resolved.message,
              };

  return { state, refresh };
}
