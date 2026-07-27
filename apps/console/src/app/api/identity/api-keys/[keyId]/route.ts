// SOURCING: none. Same-origin API key revocation proxy.

import {
  assertSameOriginIdentityMutation,
  forkIdentityErrorResponse,
  forkIdentityResponse,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> },
) {
  try {
    assertSameOriginIdentityMutation(request);
    const [{ keyId }, principal] = await Promise.all([
      params,
      resolveForkIdentityPrincipal(),
    ]);
    return forkIdentityResponse(
      await requestForkIdentity(`/v1/api-keys/${encodeURIComponent(keyId)}`, {
        method: 'DELETE',
        body: { principal },
      }),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
