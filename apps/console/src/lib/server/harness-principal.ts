import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { githubTenantSlug } from '@/lib/account-identity';
import { githubAuthCredentials } from '@/lib/auth-config';
import { IdentitySessionSchema } from '@/lib/identity/contracts';
import {
  configuredServiceTenantMatches as configuredServiceTenantMatchesCore,
  legacyServicePrincipal,
  principalFromSession,
  principalScopeHeaders,
  type HarnessPrincipal,
} from '@/lib/harness-principal-core';
import {
  ACTIVE_WORKSPACE_COOKIE,
  decodeActiveWorkspaceClaims,
  resolveActiveWorkspaceSecret,
} from '@/lib/server/active-workspace';
import {
  forkIdentityErrorResponse,
  forkIdentityResponse,
  requestForkIdentity,
} from '@/lib/server/fork-identity';

export type { HarnessPrincipal } from '@/lib/harness-principal-core';
export { filterRunsForTenant } from '@/lib/harness-principal-core';

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

async function clearRejectedActiveWorkspaceCookie(): Promise<void> {
  try {
    (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  } catch {
    // Server Component cookie stores are read-only. Route handlers still clear
    // the rejected claim, and the settings selection overwrites it on pages.
  }
}

async function resolveHarnessPrincipalUncached(): Promise<HarnessPrincipalResolution> {
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
  if (principal) {
    const secret = resolveActiveWorkspaceSecret();
    if (!secret) return { ok: true, principal };
    let encoded: string | undefined;
    try {
      encoded = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
    } catch {
      return { ok: true, principal };
    }
    if (!encoded) return { ok: true, principal };
    const claims = decodeActiveWorkspaceClaims(encoded, secret);
    if (!claims || claims.subject !== principal.harnessIdentity) {
      await clearRejectedActiveWorkspaceCookie();
      return {
        ok: false,
        response: Response.json(
          {
            error: 'active_workspace_claim_refused',
            message: 'The active workspace claim is invalid or expired.',
          },
          { status: 401 },
        ),
      };
    }

    try {
      const identityPrincipal = {
        subject: principal.harnessIdentity,
        username: principal.githubLogin,
        displayName: session?.user?.name ?? null,
        email: session?.user?.email ?? null,
      };
      const result = await requestForkIdentity('/v1/workspaces/list', {
        body: { principal: identityPrincipal },
      });
      if (result.status !== 200) {
        return { ok: false, response: forkIdentityResponse(result) };
      }
      const parsed = IdentitySessionSchema.safeParse(result.body);
      if (!parsed.success) {
        await clearRejectedActiveWorkspaceCookie();
        return {
          ok: false,
          response: Response.json(
            {
              error: 'active_workspace_contract_mismatch',
              message: 'Workspace membership could not be verified.',
            },
            { status: 502 },
          ),
        };
      }
      const workspace = parsed.data.workspaces.find(
        (candidate) => candidate.id === claims.workspaceId,
      );
      if (
        !workspace
        || workspace.tenant !== claims.tenant
        || workspace.scopeRef !== claims.scopeRef
        || workspace.slug !== claims.workspaceSlug
      ) {
        await clearRejectedActiveWorkspaceCookie();
        return {
          ok: false,
          response: Response.json(
            {
              error: 'active_workspace_membership_refused',
              message: 'The active workspace is no longer available to this identity.',
            },
            { status: 403 },
          ),
        };
      }
      return {
        ok: true,
        principal: {
          ...principal,
          tenant: workspace.tenant,
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          scopeRef: workspace.scopeRef,
        },
      };
    } catch (error) {
      return { ok: false, response: forkIdentityErrorResponse(error) };
    }
  }
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

export const resolveHarnessPrincipal = cache(resolveHarnessPrincipalUncached);

export function principalTenantHeaders(principal: HarnessPrincipal): Record<string, string> {
  return principalScopeHeaders(principal);
}

export function configuredServiceTenantMatches(principal: HarnessPrincipal): boolean {
  return configuredServiceTenantMatchesCore(principal, process.env.CONSOLE_HARNESS_TENANT);
}
