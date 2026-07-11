/**
 * Same-origin proxy to commonplace-api's POST /objects/query
 * (SPEC-OBJECT-CONTRACT-V2). Body/response pass through untouched; the
 * server-side API key never reaches the browser. See
 * app/api/theorem/objects/_shared.ts for the target-resolution contract
 * shared with /objects/action and /objects/views.
 */
import { jsonError, resolveObjectsTarget } from '../_shared';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const target = resolveObjectsTarget(req.headers, '/objects/query');
  if (!target.ok) return jsonError(target.status, target.message);

  const body = await req.text();
  try {
    const res = await fetch(target.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': target.apiKey },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return jsonError(502, 'CommonPlace objects backend unreachable.');
  }
}
