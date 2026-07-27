// SOURCING: none. Same-origin instance administration proxy.

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
      await requestForkIdentity('/v1/admin/overview', {
        body: { principal },
      }),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
