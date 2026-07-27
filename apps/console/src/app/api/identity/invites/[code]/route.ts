// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/models/invite.js. Adapted to the identity peer service.

import {
  assertSameOriginIdentityMutation,
  forkIdentityErrorResponse,
  forkIdentityResponse,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    return forkIdentityResponse(
      await requestForkIdentity(`/v1/invites/${encodeURIComponent(code)}`, {
        method: 'GET',
        publicRoute: true,
      }),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    assertSameOriginIdentityMutation(request);
    const [{ code }, principal] = await Promise.all([
      params,
      resolveForkIdentityPrincipal(),
    ]);
    return forkIdentityResponse(
      await requestForkIdentity(
        `/v1/invites/${encodeURIComponent(code)}/accept`,
        { body: { principal } },
      ),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
