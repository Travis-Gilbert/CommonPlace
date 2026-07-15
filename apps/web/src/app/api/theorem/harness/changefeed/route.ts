// SOURCING: none — Next.js route handler that proxies the harness Item
// changefeed (Server-Sent Events) to the browser same-origin, pinning the tenant
// server-side. Pure stream relay; no upstream component applies.
/**
 * GET /api/theorem/harness/changefeed
 *
 * Same-origin SSE proxy to the harness `/v1/tenants/{tenant}/items/events`
 * (SPEC-HARNESS-MEMORY-PROJECTION D6). The tenant is resolved here from the
 * environment and put on the upstream path, never supplied by the client, so a
 * delta for another tenant can never cross this boundary (the upstream already
 * filters per tenant).
 *
 * Fails open. If the tenant is unset, or the upstream is unreachable or returns a
 * non-stream (the changefeed needs the deployed harness to have `mcp_enabled`,
 * `THEOREM_ITEM_CHANGEFEED=on`, and `THEOREM_GRAPH_HOOKS=on`, all default off),
 * this emits a single SSE comment and closes. The client hook then simply has no
 * live updates; the mount-time listing remains the authoritative convergence
 * floor.
 */
import { THEOREM_HARNESS_ORIGIN } from '@/lib/theorem-hosted';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

export async function GET(request: Request): Promise<Response> {
  const slug = tenant();
  if (!slug) return closedStream(': tenant-unset');

  const origin = (env('THEOREM_HARNESS_API_URL') ?? THEOREM_HARNESS_ORIGIN).replace(/\/+$/, '');
  const url = `${origin}/v1/tenants/${encodeURIComponent(slug)}/items/events`;

  let upstream: Response;
  try {
    upstream = await fetch(url, { headers: requestHeaders(), signal: request.signal });
  } catch (err) {
    return closedStream(`: changefeed unreachable ${err instanceof Error ? err.message : String(err)}`);
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !upstream.body || !contentType.includes('text/event-stream')) {
    return closedStream(`: changefeed unavailable ${upstream.status}`);
  }

  return new Response(upstream.body, { status: 200, headers: SSE_HEADERS });
}

/** A valid but immediately-terminating SSE stream carrying one diagnostic
 *  comment. The client EventSource reads the comment, sees the stream end, and
 *  fails open (no live updates). */
function closedStream(comment: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`${comment}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: SSE_HEADERS });
}

function tenant(): string | undefined {
  return env('THEOREM_HARNESS_TENANT') ?? env('RUSTY_RED_MCP_DEFAULT_TENANT');
}

function requestHeaders(): HeadersInit {
  const token = env('THEOREM_HARNESS_API_TOKEN') ?? env('THEOREM_HARNESS_BEARER') ?? env('THEOREM_API_TOKEN') ?? env('HARNESS_API_KEY');
  const base: Record<string, string> = { Accept: 'text/event-stream' };
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
