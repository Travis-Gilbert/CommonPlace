// SOURCING: none. Same-origin invite creation proxy.

import {
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
