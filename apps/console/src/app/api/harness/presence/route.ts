// SOURCING: none. Thin passthrough (R2.4): presence is harness-sourced (the
// coordination room), a separate backend from the object-seam data API, so it
// carries its own env contract. Unconfigured returns 404 and the status bar
// renders no presence at all; presence appears only when the transport
// actually reports it (the truthfulness rule).

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const base = process.env.CONSOLE_HARNESS_URL;
  if (!base) {
    return Response.json({ error: 'console_harness_unconfigured' }, { status: 404 });
  }
  const tenant = process.env.CONSOLE_HARNESS_TENANT ?? 'Travis-Gilbert';
  const room = process.env.CONSOLE_HARNESS_ROOM ?? 'commonplace';
  try {
    const upstream = await fetch(
      `${base.replace(/\/$/, '')}/harness/rooms/${encodeURIComponent(room)}/presence?tenant=${encodeURIComponent(tenant)}`,
      {
        headers: process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : undefined,
        cache: 'no-store',
      },
    );
    if (!upstream.ok) {
      return Response.json({ error: 'harness_presence_failed' }, { status: upstream.status });
    }
    const payload = (await upstream.json()) as { presence?: unknown[]; count?: number };
    const count = Array.isArray(payload.presence) ? payload.presence.length : payload.count;
    if (typeof count !== 'number') {
      return Response.json({ error: 'harness_presence_shape' }, { status: 502 });
    }
    return Response.json({ count });
  } catch {
    return Response.json({ error: 'harness_unreachable' }, { status: 502 });
  }
}
