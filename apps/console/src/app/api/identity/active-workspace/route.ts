// SOURCING: none. Server-signed active workspace selection.

import { cookies } from 'next/headers';
import { IdentitySessionSchema } from '@/lib/identity/contracts';
import {
  ACTIVE_WORKSPACE_COOKIE,
  ACTIVE_WORKSPACE_TTL_SECONDS,
  encodeActiveWorkspaceClaims,
  resolveActiveWorkspaceSecret,
} from '@/lib/server/active-workspace';
import {
  ForkIdentityProxyError,
  forkIdentityErrorResponse,
  forkIdentityResponse,
  readJsonObject,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function POST(request: Request) {
  try {
    const principal = await resolveForkIdentityPrincipal();
    const body = await readJsonObject(request);
    if (typeof body.workspaceId !== 'string' || !body.workspaceId) {
      throw new ForkIdentityProxyError(
        400,
        'active_workspace_invalid',
        'A workspace ID is required',
      );
    }
    const result = await requestForkIdentity('/v1/workspaces/list', {
      body: { principal },
    });
    if (result.status !== 200) return forkIdentityResponse(result);
    const parsed = IdentitySessionSchema.safeParse(result.body);
    if (!parsed.success) {
      throw new ForkIdentityProxyError(
        502,
        'active_workspace_contract_mismatch',
        'Workspace membership could not be verified',
      );
    }
    const workspace = parsed.data.workspaces.find(
      (candidate) => candidate.id === body.workspaceId,
    );
    if (!workspace) {
      throw new ForkIdentityProxyError(
        403,
        'active_workspace_membership_refused',
        'This identity is not a member of the requested workspace',
      );
    }
    const secret = resolveActiveWorkspaceSecret();
    if (!secret) {
      throw new ForkIdentityProxyError(
        503,
        'active_workspace_unconfigured',
        'Active workspace signing is not configured',
      );
    }
    (await cookies()).set(
      ACTIVE_WORKSPACE_COOKIE,
      encodeActiveWorkspaceClaims(
        {
          subject: principal.subject,
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          tenant: workspace.tenant,
          scopeRef: workspace.scopeRef,
        },
        secret,
      ),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: ACTIVE_WORKSPACE_TTL_SECONDS,
      },
    );
    return Response.json({ workspace });
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    await resolveForkIdentityPrincipal();
    (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return Response.json({ cleared: true });
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
