// SOURCING: none. Same-origin API key administration proxy.

import {
  assertSameOriginIdentityMutation,
  forkIdentityErrorResponse,
  forkIdentityResponse,
  requestForkIdentity,
  resolveForkIdentityPrincipal,
  type ForkIdentityResponse,
} from '@/lib/server/fork-identity';

import { API_KEY_REVOCATION_CACHE_SECS } from './policy';

const DEFAULT_DUAL_LANE_SCOPES = Object.freeze([
  'models:invoke',
  'agent:bind',
  'workspace.read',
  'content.read',
  'chat.write',
]);

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
    assertSameOriginIdentityMutation(request);
    const [{ workspaceId }, principal] = await Promise.all([
      params,
      resolveForkIdentityPrincipal(),
    ]);
    let body: {
      name?: string;
      scopes?: string[];
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }
    const scopes =
      Array.isArray(body.scopes) && body.scopes.length > 0
        ? body.scopes
        : [...DEFAULT_DUAL_LANE_SCOPES];
    const result = await requestForkIdentity(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/api-keys`,
      {
        body: {
          principal,
          apiKey: {
            name: body.name ?? 'Theorem key',
            scopes,
          },
        },
      },
    );
    const enriched: ForkIdentityResponse = {
      status: result.status,
      body:
        result.body && typeof result.body === 'object'
          ? {
              ...(result.body as Record<string, unknown>),
              revocationCacheSeconds: API_KEY_REVOCATION_CACHE_SECS,
            }
          : {
              result: result.body,
              revocationCacheSeconds: API_KEY_REVOCATION_CACHE_SECS,
            },
    };
    return forkIdentityResponse(enriched);
  } catch (error) {
    return forkIdentityErrorResponse(error);
  }
}
