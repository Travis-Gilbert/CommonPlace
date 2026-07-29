// SOURCING: none. Same-origin relay for authenticated Agent Space events.

import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ path: string[] }> };

function eventsBase(): string | null {
  const configured = process.env.THEOREM_MCP_EVENTS_URL;
  if (configured) return configured.replace(/\/$/, '');
  const harness = process.env.CONSOLE_HARNESS_URL;
  return harness ? `${harness.replace(/\/$/, '')}/events` : null;
}

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;

  const { path } = await params;
  if (path.length !== 1 || (path[0] !== 'snapshot' && path[0] !== 'stream')) {
    return Response.json({ error: 'event_path_not_found' }, { status: 404 });
  }

  const base = eventsBase();
  if (!base) return Response.json({ error: 'harness_events_unconfigured' }, { status: 404 });

  const incoming = new URL(request.url);
  incoming.searchParams.delete('tenant');
  const endpoint = new URL(`${base}/${path[0]}`);
  endpoint.search = incoming.search;
  const token = process.env.CONSOLE_HARNESS_TOKEN ?? process.env.THEOREM_API_KEY;

  try {
    const upstream = await fetch(endpoint, {
      headers: {
        Accept: path[0] === 'stream' ? 'text/event-stream' : 'application/json',
        ...principalTenantHeaders(resolution.principal),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: 'harness_events_failed' }, { status: upstream.status });
    }

    if (path[0] === 'stream') {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ error: 'harness_events_unreachable' }, { status: 502 });
  }
}
