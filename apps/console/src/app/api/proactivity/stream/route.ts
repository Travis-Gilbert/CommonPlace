// SOURCING: none. Tenant-filtered SSE relay. The browser opens only this
// same-origin endpoint; the server derives both tenant headers and credentials
// before subscribing upstream.

import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  const tenant = resolution.principal.tenant;
  const base = process.env.THEOREM_PROACTIVITY_CHANGEFEED_URL;
  if (!base) return Response.json({ error: 'proactivity_changefeed_unconfigured' }, { status: 404 });
  const endpoint = `${base}${base.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(tenant)}`;
  try {
    const upstream = await fetch(endpoint, {
      headers: {
        Accept: 'text/event-stream',
        ...principalTenantHeaders(resolution.principal),
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
        ...(process.env.THEOREM_API_KEY ? { 'x-api-key': process.env.THEOREM_API_KEY } : {}),
      },
      cache: 'no-store',
    });
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: 'proactivity_changefeed_failed' }, { status: upstream.status });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch {
    return Response.json({ error: 'proactivity_changefeed_unreachable' }, { status: 502 });
  }
}
