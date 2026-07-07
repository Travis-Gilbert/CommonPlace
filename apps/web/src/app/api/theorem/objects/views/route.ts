/**
 * Same-origin proxy to commonplace-api's GET /objects/views
 * (SPEC-OBJECT-CONTRACT-V2). Returns the server's ViewDescriptor[] as-is;
 * the client attaches `render` locally via resolveSurfaceRenderer since a
 * React component cannot serialize over the wire. See
 * app/api/theorem/objects/_shared.ts for the shared target-resolution
 * contract.
 */
import { jsonError, resolveObjectsTarget } from '../_shared';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const target = resolveObjectsTarget(req.headers, '/objects/views');
  if (!target.ok) return jsonError(target.status, target.message);

  try {
    const res = await fetch(target.endpoint, {
      method: 'GET',
      headers: { 'x-api-key': target.apiKey },
      cache: 'no-store',
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return jsonError(502, 'CommonPlace objects backend unreachable.');
  }
}
