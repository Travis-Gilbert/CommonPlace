// SOURCING: none. Thin passthrough (K4): For me submits through the harness
// delegate path (handoff plus job with the pack; the room appears in the
// strip). Same env contract as presence/runs: unconfigured returns 404 and
// the sheet renders its named unavailable state; an upstream refusal (the
// identity refusal observable in production) passes its status through so the
// sheet can name it. No fixture rooms ever render.

import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  const base = process.env.CONSOLE_HARNESS_URL;
  if (!base) {
    return Response.json({ error: 'console_harness_unconfigured' }, { status: 404 });
  }
  const tenant = resolution.principal.tenant;
  const room = process.env.CONSOLE_HARNESS_ROOM ?? 'commonplace';
  const pack = await req.text();
  const timeout = startHarnessRequestTimeout();
  try {
    const upstream = await fetch(
      `${base.replace(/\/$/, '')}/harness/rooms/${encodeURIComponent(room)}/handoffs?tenant=${encodeURIComponent(tenant)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.CONSOLE_HARNESS_TOKEN
            ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
            : {}),
        },
        body: pack,
        cache: 'no-store',
        signal: timeout.signal,
      },
    );
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    if (timeout.didTimeout()) {
      return Response.json({ error: 'harness_delegate_timeout' }, { status: 504 });
    }
    return Response.json({ error: 'harness_unreachable' }, { status: 502 });
  } finally {
    timeout.clear();
  }
}
