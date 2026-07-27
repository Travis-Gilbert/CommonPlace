// SOURCING: none. Same-origin API key revocation proxy.

import {
  forkIdentityErrorResponse,
  forkIdentityResponse,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ keyId: string }> },
) {
  try {
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
