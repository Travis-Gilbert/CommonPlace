// SOURCING: none. Same-origin principal reconciliation proxy.

import {
  forkIdentityErrorResponse,
  forkIdentityResponse,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function GET() {
  try {
    const principal = await resolveForkIdentityPrincipal();
    return forkIdentityResponse(
      await requestForkIdentity('/v1/principals/reconcile', {
        body: { principal },
      }),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
