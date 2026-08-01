// SOURCING: none. Same-origin workspace-scoped API key revocation proxy.

import {
  assertSameOriginIdentityMutation,
  forkIdentityErrorResponse,
  forkIdentityResponse,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function DELETE(
  request: Request,
  {
    params,
  }: { params: Promise<{ workspaceId: string; keyId: string }> },
) {
  try {
    assertSameOriginIdentityMutation(request);
    const [{ workspaceId, keyId }, principal] = await Promise.all([
      params,
      resolveForkIdentityPrincipal(),
    ]);
    return forkIdentityResponse(
      await requestForkIdentity(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}`
          + `/api-keys/${encodeURIComponent(keyId)}`,
        {
          method: 'DELETE',
          body: { principal },
        },
      ),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
