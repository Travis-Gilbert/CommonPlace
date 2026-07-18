// SOURCING: none. Tenant-filtered same-origin proxy for the Harness Item SSE
// changefeed. The server keeps the bearer token out of the browser.

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const tenant = process.env.CONSOLE_HARNESS_TENANT?.trim();
  if (!tenant) return Response.json({ error: 'missing_mcp_tenant' }, { status: 400 });
  const base = process.env.THEOREM_ITEM_CHANGEFEED_URL ?? process.env.CONSOLE_HARNESS_URL;
  if (!base) return Response.json({ error: 'harness_changefeed_unconfigured' }, { status: 404 });
  const endpoint = process.env.THEOREM_ITEM_CHANGEFEED_URL
    ? `${base}${base.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(tenant)}`
    : `${base.replace(/\/$/, '')}/v1/items/stream?tenant=${encodeURIComponent(tenant)}`;
  try {
    const upstream = await fetch(endpoint, {
      headers: {
        Accept: 'text/event-stream',
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
        ...(process.env.THEOREM_API_KEY
          ? { 'x-api-key': process.env.THEOREM_API_KEY }
          : {}),
      },
      cache: 'no-store',
    });
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: 'harness_changefeed_failed' }, { status: upstream.status });
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
    return Response.json({ error: 'harness_changefeed_unreachable' }, { status: 502 });
  }
}
