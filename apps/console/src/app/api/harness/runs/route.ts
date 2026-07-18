// SOURCING: none. Thin passthrough (R2.5): the real runs source is the
// harness runs endpoint. Unconfigured returns 404; the run widget and the
// island's Runs scope render their empty or unavailable states, never a
// fixture run.

import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  const base = process.env.CONSOLE_HARNESS_URL;
  if (!base) {
    return Response.json({ error: 'console_harness_unconfigured' }, { status: 404 });
  }
  try {
    const tenant = resolution.principal.tenant;
    const upstream = await fetch(
      `${base.replace(/\/$/, '')}/harness/runs?tenant=${encodeURIComponent(tenant)}`,
      {
        headers: process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : undefined,
        cache: 'no-store',
      },
    );
    if (!upstream.ok) {
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const payload = await upstream.json() as { runs?: unknown[] };
    const runs = Array.isArray(payload.runs)
      ? payload.runs.filter((candidate) => {
          if (!candidate || typeof candidate !== 'object') return false;
          const scope = (candidate as { scope?: unknown }).scope;
          if (!scope || typeof scope !== 'object') return false;
          const record = scope as Record<string, unknown>;
          return record.tenant === tenant || record.tenant_slug === tenant;
        })
      : [];
    return Response.json({ tenant, runs });
  } catch {
    return Response.json({ error: 'harness_unreachable' }, { status: 502 });
  }
}
