// SOURCING: none. Thin passthrough (R2.5): the real runs source is the
// harness runs endpoint. Unconfigured returns 404; the run widget and the
// island's Runs scope render their empty or unavailable states, never a
// fixture run.

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const base = process.env.CONSOLE_HARNESS_URL;
  if (!base) {
    return Response.json({ error: 'console_harness_unconfigured' }, { status: 404 });
  }
  try {
    const upstream = await fetch(`${base.replace(/\/$/, '')}/harness/runs`, {
      headers: process.env.CONSOLE_HARNESS_TOKEN
        ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
        : undefined,
      cache: 'no-store',
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return Response.json({ error: 'harness_unreachable' }, { status: 502 });
  }
}
