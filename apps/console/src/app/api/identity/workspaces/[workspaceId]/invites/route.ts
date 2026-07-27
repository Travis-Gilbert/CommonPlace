// SOURCING: none. Same-origin invite creation proxy.

import {
  assertSameOriginIdentityMutation,
  forkIdentityErrorResponse,
  forkIdentityResponse,
  readJsonObject,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    assertSameOriginIdentityMutation(request);
    const principal = await resolveForkIdentityPrincipal();
    const [{ workspaceId }, invite] = await Promise.all([
      params,
      readJsonObject(request),
    ]);
    return forkIdentityResponse(
      await requestForkIdentity(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/invites`,
        { body: { principal, invite } },
      ),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
