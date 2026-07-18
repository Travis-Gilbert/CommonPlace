import { auth } from '@/lib/auth';
import { githubTenantSlug } from '@/lib/account-identity';
import { githubAuthCredentials } from '@/lib/auth-config';
import {
  legacyServicePrincipal,
  principalFromSession,
  type HarnessPrincipal,
} from '@/lib/harness-principal-core';

export type HarnessPrincipalResolution =
  | { readonly ok: true; readonly principal: HarnessPrincipal }
  | { readonly ok: false; readonly response: Response };

function fixturePrincipal(): HarnessPrincipal | null {
  if (process.env.NODE_ENV === 'production') return null;
  const githubLogin = process.env.CONSOLE_E2E_GITHUB_LOGIN;
  const harnessIdentity = process.env.CONSOLE_E2E_HARNESS_IDENTITY;
  const tenant = githubTenantSlug(githubLogin);
  if (!tenant || !githubLogin || !harnessIdentity) return null;
  return { tenant, githubLogin, harnessIdentity };
}

export async function resolveHarnessPrincipal(): Promise<HarnessPrincipalResolution> {
  const fixture = fixturePrincipal();
  if (fixture) return { ok: true, principal: fixture };
  const github = githubAuthCredentials({
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
  });
  const legacy = legacyServicePrincipal(process.env.CONSOLE_HARNESS_TENANT, github !== null);
  if (legacy) return { ok: true, principal: legacy };
  const session = await auth();
  const principal = principalFromSession(session);
  if (principal) return { ok: true, principal };
  return {
    ok: false,
    response: Response.json(
      {
        error: 'principal_resolution=unauthenticated',
        message: 'Sign in with GitHub from the CommonPlace Account surface.',
      },
      { status: 401 },
    ),
  };
}

export function principalTenantHeaders(principal: HarnessPrincipal): Record<string, string> {
  return {
    'x-theorem-tenant': principal.tenant,
    'x-tenant-id': principal.tenant,
    'x-theorem-principal': principal.harnessIdentity,
  };
}

export function configuredServiceTenantMatches(principal: HarnessPrincipal): boolean {
  const configured = process.env.CONSOLE_HARNESS_TENANT?.trim();
  return Boolean(configured && configured.toLowerCase() === principal.tenant.toLowerCase());
}
