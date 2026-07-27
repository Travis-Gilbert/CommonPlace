// SOURCING: none. Same-origin workspace settings proxy.

import {
  assertSameOriginIdentityMutation,
  forkIdentityErrorResponse,
  forkIdentityResponse,
  readJsonObject,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    assertSameOriginIdentityMutation(request);
    const principal = await resolveForkIdentityPrincipal();
    const [{ workspaceId }, workspace] = await Promise.all([
      params,
      readJsonObject(request),
    ]);
    return forkIdentityResponse(
      await requestForkIdentity(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}`,
        { method: 'PATCH', body: { principal, workspace } },
      ),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
