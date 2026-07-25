'use client';

// SOURCING: Auth.js owns GitHub OAuth, session state, and sign-out behavior.
// This is a registered workspace view, so account identity occupies the same
// descriptor seam as every other Console surface.

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { githubTenantSlug } from '@/lib/account-identity';
import { IconAccount } from '@/components/shell/icons';

type ProviderState = 'loading' | 'ready' | 'unconfigured';

export function AccountView(_props: ViewRenderProps) {
  const { data: session, status } = useSession();
  const [providerState, setProviderState] = useState<ProviderState>('loading');
  const [credentialMeta, setCredentialMeta] = useState<{
    keyId: string;
    tenant: string;
    expiresAtMs: number | null;
  } | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const user = session?.user;
  const login = user?.githubLogin;
  const tenant = githubTenantSlug(login);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5_000);
    void fetch('/api/auth/providers', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const providers = response.ok
          ? await response.json() as Record<string, unknown>
          : {};
        if (active) setProviderState('github' in providers ? 'ready' : 'unconfigured');
      })
      .catch(() => {
        if (active) setProviderState('unconfigured');
      })
      .finally(() => {
        window.clearTimeout(timer);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      setCredentialMeta(null);
      setCredentialError(null);
      return;
    }
    let active = true;
    void fetch('/api/account/credentials', { cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json()) as {
          keyId?: string;
          tenant?: string;
          expiresAtMs?: number | null;
          error?: string;
          message?: string;
          kind?: string;
        };
        if (!active) return;
        if (!response.ok) {
          setCredentialMeta(null);
          setCredentialError(body.message ?? body.error ?? 'Credential unavailable');
          return;
        }
        if (body.kind === 'service_key') {
          setCredentialMeta(null);
          setCredentialError(null);
          return;
        }
        if (typeof body.keyId === 'string' && typeof body.tenant === 'string') {
          setCredentialMeta({
            keyId: body.keyId,
            tenant: body.tenant,
            expiresAtMs: typeof body.expiresAtMs === 'number' ? body.expiresAtMs : null,
          });
          setCredentialError(null);
        }
      })
      .catch(() => {
        if (active) setCredentialError('Could not reach credential issuance.');
      });
    return () => {
      active = false;
    };
  }, [status]);

  const beginGithubSignIn = () => {
    if (providerState !== 'ready') return;
    void signIn('github', { redirectTo: '/' });
  };

  return (
    <div data-account-view className="h-full overflow-y-auto bg-ij-editor text-ij-ink">
      <div className="mx-auto grid max-w-5xl gap-6 p-6">
        <header className="grid gap-1">
          <div className="flex items-center gap-2">
            <IconAccount size={18} />
            <h1 className="text-xl" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Account</h1>
          </div>
          <p className="text-ij-ink-info">
            Your verified identity owns your Harness workspace. There is no shared default tenant.
          </p>
        </header>

        <section
          className="grid gap-4 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-4"
          aria-labelledby="account-identity-heading"
        >
          <div>
            <h2 id="account-identity-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
              Profile and identity
            </h2>
            <p className="text-ij-ink-info">
              GitHub verifies the person. CommonPlace derives that person&apos;s tenant from the verified login.
            </p>
          </div>

          {status === 'loading' ? (
            <p aria-live="polite" className="text-ij-ink-info">Checking your session...</p>
          ) : user ? (
            <div className="grid gap-4">
              <dl className="grid gap-2 rounded-ij-arc bg-ij-editor p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-ij-ink-info">Signed in as</dt>
                  <dd style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                    {user.name || login || 'GitHub account'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ij-ink-info">Harness tenant</dt>
                  <dd className="font-ij-mono" data-account-tenant>{tenant ?? 'Identity refused'}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => void signOut({ redirectTo: '/' })}
                className="h-ij-control w-fit rounded-ij-arc border border-ij-control-border bg-ij-raised px-4 text-ij-ink hover:bg-ij-hover-surface"
              >
                Sign out
              </button>
              <section
                className="grid gap-2 rounded-ij-arc bg-ij-editor p-4"
                aria-labelledby="account-credential-heading"
              >
                <h3 id="account-credential-heading" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                  Object-seam credential
                </h3>
                <p className="text-ij-ink-info">
                  Issued server-side for your tenant. The secret is never shown here after issuance.
                </p>
                {credentialError ? (
                  <p role="status" className="text-ij-warn">{credentialError}</p>
                ) : credentialMeta ? (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-ij-ink-info">Key id</dt>
                      <dd className="font-ij-mono">{credentialMeta.keyId}</dd>
                    </div>
                    <div>
                      <dt className="text-ij-ink-info">Tenant</dt>
                      <dd className="font-ij-mono">{credentialMeta.tenant}</dd>
                    </div>
                    <div>
                      <dt className="text-ij-ink-info">Expires</dt>
                      <dd className="font-ij-mono">
                        {credentialMeta.expiresAtMs
                          ? new Date(credentialMeta.expiresAtMs).toISOString()
                          : 'none'}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-ij-ink-info">Issuing credential...</p>
                )}
              </section>
            </div>
          ) : (
            <div className="grid gap-3">
              <button
                type="button"
                data-github-sign-in
                disabled={providerState !== 'ready'}
                onClick={beginGithubSignIn}
                className="h-ij-control w-fit rounded-ij-arc bg-ij-accent px-4 text-ij-ink-bright disabled:cursor-not-allowed disabled:opacity-60"
              >
                {providerState === 'loading'
                  ? 'Checking GitHub login...'
                  : providerState === 'ready'
                    ? 'Sign in with GitHub'
                    : 'GitHub login is not configured'}
              </button>
              {providerState === 'unconfigured' ? (
                <p role="status" className="text-ij-warn">
                  Login is temporarily unavailable. This control is disabled so it cannot send you to a broken GitHub authorization page.
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
