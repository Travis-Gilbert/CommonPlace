// SOURCING: none. The digest is pulled, never pushed. There is no stream here
// and no subscription: a person asks what arrived and gets an answer, which is
// the whole difference between a digest and a notification.

import { readDigest } from '@/lib/server/filing-harness';

export const dynamic = 'force-dynamic';

/** A day, the window a "what arrived" question usually means. */
const DEFAULT_DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request): Promise<Response> {
  const since = Number(new URL(request.url).searchParams.get('since'));
  const sinceMs =
    Number.isFinite(since) && since > 0 ? since : Date.now() - DEFAULT_DIGEST_WINDOW_MS;
  const result = await readDigest(sinceMs);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tenant: result.tenant, groups: result.data, sinceMs });
}
