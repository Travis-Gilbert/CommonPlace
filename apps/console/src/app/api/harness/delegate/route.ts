// SOURCING: none. Thin passthrough (K4): For me submits through the harness
// delegate path (handoff plus job with the pack; the room appears in the
// strip). Same env contract as presence/runs: unconfigured returns 404 and
// the sheet renders its named unavailable state; an upstream refusal (the
// identity refusal observable in production) passes its status through so the
// sheet can name it. No fixture rooms ever render.

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const base = process.env.CONSOLE_HARNESS_URL;
  if (!base) {
    return Response.json({ error: 'console_harness_unconfigured' }, { status: 404 });
  }
  const tenant = process.env.CONSOLE_HARNESS_TENANT ?? 'Travis-Gilbert';
  const room = process.env.CONSOLE_HARNESS_ROOM ?? 'commonplace';
  const pack = await req.text();
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
      },
    );
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    return Response.json({ error: 'harness_unreachable' }, { status: 502 });
  }
}
