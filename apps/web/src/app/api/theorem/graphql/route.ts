/**
 * Same-origin proxy to Theorem's commonplace-api GraphQL.
 *
 * The browser posts here (no CORS, no API key in the client bundle); this
 * handler forwards to the Theorem GraphQL endpoint with the server-side key.
 * On Vercel, set THEOREM_GRAPHQL_URL to the Railway commonplace-api URL and
 * THEOREM_API_KEY to its instance key (both server-only, never NEXT_PUBLIC).
 */

import {
  COMMONPLACE_INSTANCE_KEY_HEADER,
  COMMONPLACE_INSTANCE_URL_HEADER,
  isAllowedLocalCommonPlaceHost,
  normalizeCommonPlaceGraphqlEndpoint,
} from '@/lib/commonplace-instance';

const configuredUpstream = process.env.THEOREM_GRAPHQL_URL?.trim();
const hasConfiguredUpstream = Boolean(configuredUpstream);
const UPSTREAM =
  normalizeCommonPlaceGraphqlEndpoint(configuredUpstream || 'http://localhost:50090')
  ?? 'http://localhost:50090/graphql';
const API_KEY = process.env.THEOREM_API_KEY ?? 'dev-key';
const CLIENT_INSTANCE_DEFAULT_API_KEY =
  process.env.COMMONPLACE_CLIENT_INSTANCE_DEFAULT_API_KEY ?? 'dev-key';
const softFailLocalDefault =
  process.env.NODE_ENV === 'development' && !hasConfiguredUpstream;
const allowClientInstanceOverride =
  process.env.NODE_ENV === 'development' ||
  process.env.COMMONPLACE_ALLOW_CLIENT_INSTANCE_OVERRIDE === '1';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  const target = resolveTarget(req.headers);
  if (!target.ok) {
    return jsonError(target.status, target.message);
  }

  try {
    const res = await fetch(target.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': target.apiKey },
      body,
      cache: 'no-store',
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    const status = softFailLocalDefault && !target.fromClient ? 200 : 502;
    return new Response(
      JSON.stringify({ errors: [{ message: 'Theorem GraphQL backend unreachable' }] }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

type TargetResult =
  | { ok: true; endpoint: string; apiKey: string; fromClient: boolean }
  | { ok: false; status: number; message: string };

function resolveTarget(headers: Headers): TargetResult {
  const clientUrl = text(headers.get(COMMONPLACE_INSTANCE_URL_HEADER));
  const clientKey = text(headers.get(COMMONPLACE_INSTANCE_KEY_HEADER));

  if (!clientUrl && !clientKey) {
    return { ok: true, endpoint: UPSTREAM, apiKey: API_KEY, fromClient: false };
  }
  if (!allowClientInstanceOverride) {
    return {
      ok: false,
      status: 403,
      message: 'Self-hosted instance login is not enabled on this deployment.',
    };
  }
  if (!clientUrl) {
    return {
      ok: false,
      status: 400,
      message: 'Self-hosted instance login requires an instance URL.',
    };
  }

  const endpoint = normalizeCommonPlaceGraphqlEndpoint(clientUrl);
  if (!endpoint) {
    return {
      ok: false,
      status: 400,
      message: 'Self-hosted instance URL must be an HTTP or HTTPS URL.',
    };
  }

  const hostname = new URL(endpoint).hostname;
  if (!isAllowedLocalCommonPlaceHost(hostname)) {
    return {
      ok: false,
      status: 400,
      message: 'Self-hosted instance URL must point to localhost or a private LAN host.',
    };
  }

  return {
    ok: true,
    endpoint,
    apiKey: clientKey || CLIENT_INSTANCE_DEFAULT_API_KEY,
    fromClient: true,
  };
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ errors: [{ message }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
