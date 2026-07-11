/**
 * Shared target resolution for the SPEC-OBJECT-CONTRACT-V2 same-origin proxy
 * routes (`/api/theorem/objects/query|action|views`). Mirrors
 * `app/api/theorem/graphql/route.ts`'s resolveTarget so the browser never
 * holds the server-side API key, and self-hosted instance override headers
 * work the same way across both proxy families.
 */
import {
  COMMONPLACE_INSTANCE_KEY_HEADER,
  COMMONPLACE_INSTANCE_URL_HEADER,
  isAllowedLocalCommonPlaceHost,
  normalizeCommonPlaceObjectsEndpoint,
} from '@/lib/commonplace-instance';

// The objects routes and /graphql are mounted on the same axum Router in
// commonplace-api (apps/commonplace-api/src/serve.rs), so THEOREM_GRAPHQL_URL
// is a valid fallback base once any literal trailing "/graphql" is stripped.
const configuredUpstream =
  process.env.THEOREM_OBJECTS_URL?.trim() ||
  process.env.THEOREM_GRAPHQL_URL?.trim()?.replace(/\/graphql\/?$/, '');
const DEFAULT_UPSTREAM_BASE = 'http://localhost:50090';
const API_KEY = process.env.THEOREM_API_KEY ?? 'dev-key';
const CLIENT_INSTANCE_DEFAULT_API_KEY =
  process.env.COMMONPLACE_CLIENT_INSTANCE_DEFAULT_API_KEY ?? 'dev-key';
const allowClientInstanceOverride =
  process.env.NODE_ENV === 'development' ||
  process.env.COMMONPLACE_ALLOW_CLIENT_INSTANCE_OVERRIDE === '1';

export type ObjectsTargetResult =
  | { ok: true; endpoint: string; apiKey: string }
  | { ok: false; status: number; message: string };

/** suffix e.g. "/objects/query" */
export function resolveObjectsTarget(headers: Headers, suffix: string): ObjectsTargetResult {
  const clientUrl = text(headers.get(COMMONPLACE_INSTANCE_URL_HEADER));
  const clientKey = text(headers.get(COMMONPLACE_INSTANCE_KEY_HEADER));

  const base = clientUrl || configuredUpstream || DEFAULT_UPSTREAM_BASE;
  if (clientUrl && !allowClientInstanceOverride) {
    return {
      ok: false,
      status: 403,
      message: 'Self-hosted instance login is not enabled on this deployment.',
    };
  }

  const endpoint = normalizeCommonPlaceObjectsEndpoint(base, suffix);
  if (!endpoint) {
    return { ok: false, status: 400, message: 'Instance URL must be an HTTP or HTTPS URL.' };
  }

  if (clientUrl) {
    const hostname = new URL(endpoint).hostname;
    if (!isAllowedLocalCommonPlaceHost(hostname)) {
      return {
        ok: false,
        status: 400,
        message: 'Self-hosted instance URL must point to localhost or a private LAN host.',
      };
    }
  }

  return { ok: true, endpoint, apiKey: clientUrl ? clientKey || CLIENT_INSTANCE_DEFAULT_API_KEY : API_KEY };
}

export function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
