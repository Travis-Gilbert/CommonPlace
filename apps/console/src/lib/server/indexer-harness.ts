// SOURCING: none. Server-only GraphQL adapter for the Indexer projection
// (`topicIndexerObjects`). Mirrors filing-harness.ts: this module alone knows
// harness credentials and tenant headers; the browser never talks to Theorem
// GraphQL directly.

import 'server-only';

import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';
import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';
import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';

export type IndexerRead =
  | { readonly ok: true; readonly tenant: string; readonly objects: readonly ObjectRef[] }
  | { readonly ok: false; readonly status: number; readonly error: string };

const INDEXER_OBJECTS_QUERY = `
  query ConsoleIndexerObjects($topicId: String, $includeCaptures: Boolean) {
    topicIndexerObjects(topicId: $topicId, includeCaptures: $includeCaptures)
  }
`;

function graphqlUrl(): string | null {
  const explicit = process.env.THEOREM_GRAPHQL_URL;
  if (explicit) return explicit;
  const base = process.env.CONSOLE_HARNESS_URL;
  return base ? `${base.replace(/\/$/, '')}/graphql` : null;
}

function isObjectRef(value: unknown): value is ObjectRef {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string'
    && typeof candidate.type === 'string'
    && typeof candidate.properties === 'object'
    && candidate.properties !== null
    && !Array.isArray(candidate.properties)
  );
}

function objectsFromPayload(data: Record<string, unknown>): ObjectRef[] {
  const projected = data.topicIndexerObjects;
  if (typeof projected !== 'object' || projected === null || Array.isArray(projected)) return [];
  const objects = (projected as { objects?: unknown }).objects;
  if (!Array.isArray(objects)) return [];
  return objects.filter(isObjectRef).map((object) => ({
    id: object.id,
    type: object.type,
    properties: object.properties as Record<string, JsonValue>,
  }));
}

export async function readIndexerPreviewAsset(assetId: string): Promise<
  | { readonly ok: true; readonly contentType: string; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly status: number; readonly error: string }
> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    return { ok: false, status: resolution.response.status, error: 'principal_resolution=unauthenticated' };
  }
  const endpoint = graphqlUrl();
  if (!endpoint) return { ok: false, status: 404, error: 'indexer_graphql_unconfigured' };
  if (!/^[0-9a-fA-F]+$/.test(assetId)) {
    return { ok: false, status: 400, error: 'invalid_preview_asset_id' };
  }

  const timeout = startHarnessRequestTimeout();
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...principalTenantHeaders(resolution.principal),
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
        ...(process.env.THEOREM_API_KEY ? { 'x-api-key': process.env.THEOREM_API_KEY } : {}),
      },
      body: JSON.stringify({
        query: `
          query ConsoleIndexerPreview($assetId: String!) {
            topicPreviewAsset(assetId: $assetId)
          }
        `,
        variables: { assetId },
      }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    const payload = await upstream.json().catch(() => null) as {
      data?: { topicPreviewAsset?: { content_type?: unknown; bytes_base64?: unknown } | null };
      errors?: Array<{ message?: unknown }>;
    } | null;
    const asset = payload?.data?.topicPreviewAsset;
    const contentType = typeof asset?.content_type === 'string' ? asset.content_type : null;
    const bytesBase64 = typeof asset?.bytes_base64 === 'string' ? asset.bytes_base64 : null;
    if (!upstream.ok || payload?.errors || !contentType || !bytesBase64) {
      const detail = payload?.errors?.[0]?.message;
      return {
        ok: false,
        status: upstream.ok ? 404 : upstream.status,
        error: typeof detail === 'string' ? detail : 'indexer_preview_unavailable',
      };
    }
    const binary = Buffer.from(bytesBase64, 'base64');
    return { ok: true, contentType, bytes: new Uint8Array(binary) };
  } catch {
    return {
      ok: false,
      status: timeout.didTimeout() ? 504 : 502,
      error: timeout.didTimeout() ? 'indexer_graphql_timeout' : 'indexer_graphql_unreachable',
    };
  } finally {
    timeout.clear();
  }
}

export async function readIndexerObjects(options: {
  readonly topicId?: string;
  readonly includeCaptures?: boolean;
}): Promise<IndexerRead> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    return { ok: false, status: resolution.response.status, error: 'principal_resolution=unauthenticated' };
  }
  const endpoint = graphqlUrl();
  if (!endpoint) return { ok: false, status: 404, error: 'indexer_graphql_unconfigured' };

  const timeout = startHarnessRequestTimeout();
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...principalTenantHeaders(resolution.principal),
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
        ...(process.env.THEOREM_API_KEY ? { 'x-api-key': process.env.THEOREM_API_KEY } : {}),
      },
      body: JSON.stringify({
        query: INDEXER_OBJECTS_QUERY,
        variables: {
          topicId: options.topicId ?? null,
          includeCaptures: options.includeCaptures ?? Boolean(options.topicId),
        },
      }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    const payload = await upstream.json().catch(() => null) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message?: unknown }>;
    } | null;
    if (!upstream.ok || payload?.errors || !payload?.data) {
      const detail = payload?.errors?.[0]?.message;
      return {
        ok: false,
        status: upstream.ok ? 502 : upstream.status,
        error: typeof detail === 'string' ? detail : 'indexer_graphql_failed',
      };
    }
    return {
      ok: true,
      tenant: resolution.principal.tenant,
      objects: objectsFromPayload(payload.data),
    };
  } catch {
    return {
      ok: false,
      status: timeout.didTimeout() ? 504 : 502,
      error: timeout.didTimeout() ? 'indexer_graphql_timeout' : 'indexer_graphql_unreachable',
    };
  } finally {
    timeout.clear();
  }
}
