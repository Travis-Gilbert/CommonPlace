// SOURCING: zod. Same-origin adapter for the Index surface: one GET for the
// projection the surface renders, one POST for the two reversible corrections.
// The browser never reaches the harness directly and never carries a
// credential.

import { filingActionSchema } from '@/lib/filing/actions';
import { RIBBON_WINDOW_MS } from '@/lib/filing/types';
import { correctFiling, readIndex, undoFiling } from '@/lib/server/filing-harness';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const since = Number(url.searchParams.get('since'));
  // The ribbon is time-boxed and empties itself, so the default window is the
  // ribbon's own. A caller may ask for less; asking for more is how a ribbon
  // quietly becomes a queue, so the window is not unbounded.
  const sinceMs = Number.isFinite(since) && since > 0 ? since : Date.now() - RIBBON_WINDOW_MS;
  const result = await readIndex(sinceMs);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tenant: result.tenant, ...result.data, sinceMs });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = filingActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_filing_action', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const action = parsed.data;
  const result =
    action.kind === 'correct'
      ? await correctFiling(action.item, action.to)
      : await undoFiling(action.item);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tenant: result.tenant, receipt: result.data });
}
