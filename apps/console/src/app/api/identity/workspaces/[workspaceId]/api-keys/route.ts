// SOURCING: none. Same-origin API key administration proxy.

import {
  forkIdentityErrorResponse,
  forkIdentityResponse,
  readJsonObject,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const principal = await resolveForkIdentityPrincipal();
    const [{ workspaceId }, apiKey] = await Promise.all([
      params,
      readJsonObject(request),
    ]);
    return forkIdentityResponse(
      await requestForkIdentity(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/api-keys`,
        { body: { principal, apiKey } },
      ),
    );
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
