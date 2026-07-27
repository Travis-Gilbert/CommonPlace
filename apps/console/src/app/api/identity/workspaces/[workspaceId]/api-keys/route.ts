// SOURCING: none. Same-origin API key administration proxy.

import {
  forkIdentityErrorResponse,
  forkIdentityResponse,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
} from '@/lib/server/fork-identity';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const [{ workspaceId }, principal] = await Promise.all([
      params,
      resolveForkIdentityPrincipal(),
    ]);
    return forkIdentityResponse(
      await requestForkIdentity(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/api-keys/list`,
        { body: { principal } },
      ),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}

export async function POST() {
  try {
    await resolveForkIdentityPrincipal();
    return Response.json(
      {
        error: 'api_key_consumer_unavailable',
        message:
          'API key issuance is disabled until a public consumer enforces workspace scope',
      },
      { status: 503 },
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
