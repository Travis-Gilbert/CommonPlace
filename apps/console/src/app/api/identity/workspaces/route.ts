// SOURCING: none. Same-origin workspace identity proxy.

import {
  assertSameOriginIdentityMutation,
  forkIdentityErrorResponse,
  forkIdentityResponse,
  readJsonObject,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function GET() {
  try {
    const principal = await resolveForkIdentityPrincipal();
    return forkIdentityResponse(
      await requestForkIdentity('/v1/workspaces/list', {
        body: { principal },
      }),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginIdentityMutation(request);
    const principal = await resolveForkIdentityPrincipal();
    const workspace = await readJsonObject(request);
    return forkIdentityResponse(
      await requestForkIdentity('/v1/workspaces', {
        body: { principal, workspace },
      }),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
