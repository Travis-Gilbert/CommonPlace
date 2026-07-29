'use client';

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/pages/Login/index.jsx. Auth is replaced by Auth.js GitHub.
// Card shell adapted from the blocks.so SignIn composition (email/password
// fields omitted — CommonPlace admits only verified GitHub identity).

import { type JSX, type SVGProps, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Key } from 'lucide-react';
import { SessionProvider, signIn, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { MaterialLayer } from '@/components/ground/MaterialLayer';
import { ForkNotice } from './ForkPageFrame';
import { selectIdentityWorkspace } from '@/lib/identity/client';
import { advanceAuthenticatedLogin } from '@/lib/identity/login-advance';
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

const Logo = (props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) => (
  <svg
    fill="currentColor"
    height="48"
    viewBox="0 0 40 48"
    width="40"
    aria-hidden="true"
    {...props}
  >
    <clipPath id="commonplace-login-logo">
      <path d="m0 0h40v48h-40z" />
    </clipPath>
    <g clipPath="url(#commonplace-login-logo)">
      <path d="m25.0887 5.05386-3.933-1.05386-3.3145 12.3696-2.9923-11.16736-3.9331 1.05386 3.233 12.0655-8.05262-8.0526-2.87919 2.8792 8.83271 8.8328-10.99975-2.9474-1.05385625 3.933 12.01860625 3.2204c-.1376-.5935-.2104-1.2119-.2104-1.8473 0-4.4976 3.646-8.1436 8.1437-8.1436 4.4976 0 8.1436 3.646 8.1436 8.1436 0 .6313-.0719 1.2459-.2078 1.8359l10.9227 2.9267 1.0538-3.933-12.0664-3.2332 11.0005-2.9476-1.0539-3.933-12.0659 3.233 8.0526-8.0526-2.8792-2.87916-8.7102 8.71026z" />
      <path d="m27.8723 26.2214c-.3372 1.4256-1.0491 2.7063-2.0259 3.7324l7.913 7.9131 2.8792-2.8792z" />
      <path d="m25.7665 30.0366c-.9886 1.0097-2.2379 1.7632-3.6389 2.1515l2.8794 10.746 3.933-1.0539z" />
      <path d="m21.9807 32.2274c-.65.1671-1.3313.2559-2.0334.2559-.7522 0-1.4806-.102-2.1721-.2929l-2.882 10.7558 3.933 1.0538z" />
      <path d="m17.6361 32.1507c-1.3796-.4076-2.6067-1.1707-3.5751-2.1833l-7.9325 7.9325 2.87919 2.8792z" />
      <path d="m13.9956 29.8973c-.9518-1.019-1.6451-2.2826-1.9751-3.6862l-10.95836 2.9363 1.05385 3.933z" />
    </g>
  </svg>
);

function LoginContent({ callbackUrl }: { readonly callbackUrl: string }) {
  const authSession = useSession();
  const identity = useIdentitySession();
  const [provider, setProvider] = useState<ProviderState>('loading');
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const advancingRef = useRef(false);

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

  const identityStatus = identity.state.status;
  const readySession =
    identityStatus === 'ready' ? identity.state.session : null;
  const readyWorkspaceKey = readySession
    ? `${readySession.onboardingComplete}:${readySession.workspaces.map((workspace) => workspace.id).join(',')}`
    : null;

  useEffect(() => {
    if (!readySession || advancingRef.current) return;
    advancingRef.current = true;
    setAdvanceError(null);
    void advanceAuthenticatedLogin({
      onboardingComplete: readySession.onboardingComplete,
      workspaces: readySession.workspaces,
      callbackUrl: safeCallback(callbackUrl),
      select: selectIdentityWorkspace,
      assign: (url) => {
        window.location.assign(url);
      },
    }).catch((error: unknown) => {
      // Prefer the workspace picker over retrying /chat without a claim.
      setAdvanceError(
        error instanceof Error
          ? error.message
          : 'Could not open an admitted workspace',
      );
      window.location.assign('/onboarding');
    });
  }, [callbackUrl, identityStatus, readyWorkspaceKey, readySession]);

  const manualHref = '/onboarding';

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden text-ij-ink">
      <MaterialLayer />
      <div className="relative z-10 w-full max-w-md px-4">
        <Card className="border-ij-seam-raised bg-ij-chrome pb-0 shadow-ij-popover">
          <CardHeader className="mt-4 mb-2 space-y-1 text-center">
            <div className="flex justify-center text-ij-ink">
              <Logo />
            </div>
            <div>
              <h1 className="text-balance text-2xl" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                Sign in to CommonPlace
              </h1>
              <p className="text-pretty text-sm text-ij-ink-info">
                GitHub verifies the person. Workspace membership is resolved next.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {authSession.status === 'loading' ? (
              <p aria-live="polite" className="text-center text-sm text-ij-ink-info">
                Checking your session...
              </p>
            ) : authSession.status === 'authenticated' ? (
              <div className="grid gap-3">
                <p className="text-center text-sm">
                  Signed in as{' '}
                  <span style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                    {authSession.data.user?.githubLogin
                      ?? authSession.data.user?.name
                      ?? 'GitHub user'}
                  </span>
                </p>
                {identity.state.status === 'loading' || identity.state.status === 'auth-loading' ? (
                  <p className="text-center text-sm text-ij-ink-info">
                    Resolving workspace membership...
                  </p>
                ) : identity.state.status === 'error' ? (
                  <ForkNotice tone="error">{identity.state.message}</ForkNotice>
                ) : advanceError ? (
                  <ForkNotice tone="error">{advanceError}</ForkNotice>
                ) : identity.state.status === 'ready' ? (
                  <p className="text-center text-sm text-ij-ink-info">Opening CommonPlace...</p>
                ) : null}
                {identity.state.status === 'ready' ? (
                  <Button asChild className="w-full" size="lg">
                    <Link href={manualHref}>
                      {readySession?.onboardingComplete
                        ? 'Choose workspace'
                        : 'Continue onboarding'}
                    </Link>
                  </Button>
                ) : identity.state.status === 'error' ? null : (
                  <Button className="w-full" size="lg" disabled>
                    Resolving workspace membership...
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  type="button"
                  disabled={provider !== 'ready'}
                  onClick={() => void signIn('github', {
                    redirectTo: `/login?callbackUrl=${encodeURIComponent(safeCallback(callbackUrl))}`,
                  })}
                >
                  <Key className="mr-2 h-4 w-4" aria-hidden="true" />
                  {provider === 'loading'
                    ? 'Checking GitHub login...'
                    : provider === 'ready'
                      ? 'Continue with GitHub'
                      : 'GitHub login is not configured'}
                </Button>
                {provider === 'unconfigured' ? (
                  <ForkNotice tone="error">
                    Login is unavailable. The control is disabled so it cannot start a broken
                    authorization flow.
                  </ForkNotice>
                ) : (
                  <p className="text-center text-sm text-ij-ink-info">
                    There is no shared default tenant and no provider-selection step.
                  </p>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-center border-ij-seam bg-ij-editor">
            <p className="text-pretty text-center text-sm text-ij-ink-info">
              Identity settings live in{' '}
              <Link className="text-ij-link hover:underline" href="/settings">
                Settings
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export function LoginPage({ callbackUrl = '/chat' }: { readonly callbackUrl?: string }) {
  return (
    <SessionProvider>
      <LoginContent callbackUrl={callbackUrl} />
    </SessionProvider>
  );
}
