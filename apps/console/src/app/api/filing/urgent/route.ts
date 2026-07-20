// SOURCING: none. The urgent lane's read. It returns events, never a count:
// there is no field here a surface could render as a badge, which is the design
// law made structural rather than merely intended.

import { readUrgent } from '@/lib/server/filing-harness';

export const dynamic = 'force-dynamic';

const DEFAULT_URGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: Request): Promise<Response> {
  const since = Number(new URL(request.url).searchParams.get('since'));
  const sinceMs =
    Number.isFinite(since) && since > 0 ? since : Date.now() - DEFAULT_URGENT_WINDOW_MS;
  const result = await readUrgent(sinceMs);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tenant: result.tenant, events: result.data, sinceMs });
}
