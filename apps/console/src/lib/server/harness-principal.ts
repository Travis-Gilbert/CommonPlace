import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { githubTenantSlug } from '@/lib/account-identity';
import { githubAuthCredentials } from '@/lib/auth-config';
import { IdentitySessionSchema } from '@/lib/identity/contracts';
import {
  legacyServicePrincipal,
  principalFromSession,
  principalScopeHeaders,
  type ControlResolvedIdentity,
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

function controlPlaneBaseUrl(): string {
  return (
    process.env.CONSOLE_DATA_API_URL
    ?? process.env.THEOREM_OBJECTS_URL
    ?? 'http://localhost:50090'
  ).replace(/\/$/, '');
}

function controlPlaneServiceKey(): string {
  return process.env.CONSOLE_DATA_API_KEY ?? process.env.THEOREM_API_KEY ?? 'dev-key';
}

function isControlIdentity(value: unknown): value is ControlResolvedIdentity {
  if (!value || typeof value !== 'object') return false;
  const identity = value as Partial<ControlResolvedIdentity>;
  return Boolean(
    identity.kind === 'github'
    && identity.principal
    && typeof identity.principal.id === 'string'
    && typeof identity.principal.display_name === 'string'
    && ['human', 'agent', 'service'].includes(identity.principal.kind ?? '')
    && identity.tenant
    && typeof identity.tenant.id === 'string'
    && typeof identity.tenant.slug === 'string'
    && Array.isArray(identity.scopes)
    && identity.scopes.every((scope) => typeof scope === 'string'),
  );
}

async function resolveControlIdentity(
  session: Session | null,
  requestedTenant: string,
): Promise<ControlResolvedIdentity | Response> {
  const harnessIdentity = session?.user?.harnessIdentity;
  const tenant = githubTenantSlug(requestedTenant);
  const providerSubject =
    typeof harnessIdentity === 'string' && harnessIdentity.startsWith('github:')
      ? harnessIdentity.slice('github:'.length).trim()
      : '';
  if (!tenant || !providerSubject) {
    return Response.json(
      {
        error: 'principal_resolution=unauthenticated',
        message: 'The GitHub session is missing its verified provider subject.',
      },
      { status: 401 },
    );
  }
  let response: Response;
  try {
    response = await fetch(`${controlPlaneBaseUrl()}/identity/resolve/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': controlPlaneServiceKey(),
      },
      body: JSON.stringify({ provider_subject: providerSubject, tenant }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return Response.json(
      {
        error: 'control_plane_unavailable',
        message: 'The identity control plane could not be reached.',
      },
      { status: 503 },
    );
  }
  if (!response.ok) {
    return Response.json(
      {
        error: response.status === 403
          ? 'principal_cross_tenant_refused'
          : 'control_plane_identity_refused',
        message: 'The signed-in GitHub identity was not admitted for this tenant.',
      },
      { status: response.status },
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!isControlIdentity(body)) {
    return Response.json(
      {
        error: 'control_plane_identity_contract_mismatch',
        message: 'The identity control plane returned an invalid identity.',
      },
      { status: 502 },
    );
  }
  return body;
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
  const secret = resolveActiveWorkspaceSecret();
  if (!secret) {
    return {
      ok: false,
      response: Response.json(
        {
          error: 'active_workspace_configuration_missing',
          message: 'Active workspace verification is not configured.',
        },
        { status: 503 },
      ),
    };
  }
  let encoded: string | undefined;
  try {
    encoded = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  } catch {
    return {
      ok: false,
      response: Response.json(
        {
          error: 'active_workspace_claim_unavailable',
          message: 'The active workspace claim could not be read.',
        },
        { status: 503 },
      ),
    };
  }
  if (!encoded) {
    return {
      ok: false,
      response: Response.json(
        {
          error: 'active_workspace_claim_required',
          message: 'Select an active workspace before accessing scoped data.',
        },
        { status: 403 },
      ),
    };
  }
  const claims = decodeActiveWorkspaceClaims(encoded, secret);
  if (!claims || claims.subject !== session?.user?.harnessIdentity) {
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
  const controlIdentity = await resolveControlIdentity(session, claims.tenant);
  if (controlIdentity instanceof Response) {
    return { ok: false, response: controlIdentity };
  }
  const principal = principalFromSession(session, controlIdentity);
  if (principal) {
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
        || workspace.tenant !== principal.tenant
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
