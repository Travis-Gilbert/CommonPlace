'use client';

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/pages/Login/index.jsx. Auth is replaced by Auth.js GitHub.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SessionProvider, signIn, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { ForkNotice, ForkPageFrame, ForkPanel } from './ForkPageFrame';
import { useIdentitySession } from '@/lib/identity/use-identity-session';

type ProviderState = 'loading' | 'ready' | 'unconfigured';

const UNSAFE_CALLBACK_CHARACTER = /[\u0000-\u001F\u007F\\]/;

export function safeCallback(value: unknown): string {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !UNSAFE_CALLBACK_CHARACTER.test(value)
    ? value
    : '/chat';
}

function LoginContent({ callbackUrl }: { readonly callbackUrl: string }) {
  const authSession = useSession();
  const identity = useIdentitySession();
  const [provider, setProvider] = useState<ProviderState>('loading');

  useEffect(() => {
    let active = true;
    void fetch('/api/auth/providers', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<Record<string, unknown>> : {})
      .then((providers) => {
        if (active) setProvider('github' in providers ? 'ready' : 'unconfigured');
      })
      .catch(() => {
        if (active) setProvider('unconfigured');
      });
    return () => {
      active = false;
    };
  }, []);

  const destination =
    identity.state.status === 'ready' && !identity.state.session.onboardingComplete
      ? '/onboarding'
      : safeCallback(callbackUrl);

  return (
    <ForkPageFrame
      eyebrow="Identity"
      title="Sign in to CommonPlace"
      description="GitHub verifies the person. The identity service then resolves only that person's admitted workspaces and graph scopes."
    >
      <ForkPanel
        title="Verified GitHub identity"
        description="There is no shared default tenant and no provider-selection step."
      >
        {authSession.status === 'loading' ? (
          <p aria-live="polite" className="text-ij-ink-info">Checking your session...</p>
        ) : authSession.status === 'authenticated' ? (
          <div className="grid gap-3">
            <p>
              Signed in as{' '}
              <span style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                {authSession.data.user?.githubLogin ?? authSession.data.user?.name ?? 'GitHub user'}
              </span>
            </p>
            {identity.state.status === 'loading' || identity.state.status === 'auth-loading' ? (
              <p className="text-ij-ink-info">Resolving workspace membership...</p>
            ) : identity.state.status === 'error' ? (
              <ForkNotice tone="error">{identity.state.message}</ForkNotice>
            ) : null}
            <Button asChild>
              <Link href={destination}>
                {destination === '/onboarding' ? 'Continue onboarding' : 'Open CommonPlace'}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <Button
              type="button"
              disabled={provider !== 'ready'}
              onClick={() => void signIn('github', {
                redirectTo: `/login?callbackUrl=${encodeURIComponent(safeCallback(callbackUrl))}`,
              })}
            >
              {provider === 'loading'
                ? 'Checking GitHub login...'
                : provider === 'ready'
                  ? 'Continue with GitHub'
                  : 'GitHub login is not configured'}
            </Button>
            {provider === 'unconfigured' ? (
              <ForkNotice tone="error">
                Login is unavailable. The control is disabled so it cannot start a broken authorization flow.
              </ForkNotice>
            ) : null}
          </div>
        )}
      </ForkPanel>
    </ForkPageFrame>
  );
}

export function LoginPage({ callbackUrl = '/chat' }: { readonly callbackUrl?: string }) {
  return (
    <SessionProvider>
      <LoginContent callbackUrl={callbackUrl} />
    </SessionProvider>
  );
}
