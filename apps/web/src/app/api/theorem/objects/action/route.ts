/**
 * Same-origin proxy to commonplace-api's POST /objects/action
 * (SPEC-OBJECT-CONTRACT-V2). See app/api/theorem/objects/_shared.ts for the
 * shared target-resolution contract.
 */
import { jsonError, resolveObjectsTarget } from '../_shared';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const target = resolveObjectsTarget(req.headers, '/objects/action');
  if (!target.ok) return jsonError(target.status, target.message);

  const body = await req.text();
  try {
    const res = await fetch(target.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': target.apiKey },
      body,
      cache: 'no-store',
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return jsonError(502, 'CommonPlace objects backend unreachable.');
  }
}
