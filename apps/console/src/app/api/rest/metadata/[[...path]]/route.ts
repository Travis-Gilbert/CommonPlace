// SOURCING: none. Same-origin proxy for harness `/rest/metadata/*`.

import { forwardMetadataRest } from '@/lib/server/metadata-rest';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path?: string[] }> };

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path = [] } = await context.params;
  return forwardMetadataRest(request.method, path, request);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
