// SOURCING: none. Server-only GraphQL adapter for the Indexer projection
// (`topicIndexerObjects`). The browser never talks to Theorem directly.

import 'server-only';

import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';
import { callHarnessGraphql } from '@/lib/server/harness-graphql';

export type IndexerRead =
  | { readonly ok: true; readonly tenant: string; readonly objects: readonly ObjectRef[] }
  | { readonly ok: false; readonly status: number; readonly error: string };

const INDEXER_OBJECTS_QUERY = `
  query ConsoleIndexerObjects($topicId: String, $includeCaptures: Boolean) {
    topicIndexerObjects(topicId: $topicId, includeCaptures: $includeCaptures)
  }
`;

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

const PREVIEW_IMAGE_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function allowlistedPreviewContentType(contentType: string): string | null {
  const normalized = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!PREVIEW_IMAGE_CONTENT_TYPES.has(normalized)) return null;
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

export async function readIndexerPreviewAsset(assetId: string): Promise<
  | { readonly ok: true; readonly contentType: string; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly status: number; readonly error: string }
> {
  if (!/^[0-9a-fA-F]+$/.test(assetId)) {
    return { ok: false, status: 400, error: 'invalid_preview_asset_id' };
  }

  const result = await callHarnessGraphql(
    `
      query ConsoleIndexerPreview($assetId: String!) {
        topicPreviewAsset(assetId: $assetId)
      }
    `,
    { assetId },
  );
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: indexerError(result.error),
    };
  }
  const asset = record(result.data.topicPreviewAsset);
  const contentType = typeof asset?.content_type === 'string' ? asset.content_type : null;
  const bytesBase64 = typeof asset?.bytes_base64 === 'string' ? asset.bytes_base64 : null;
  if (!contentType || !bytesBase64) {
    return { ok: false, status: 404, error: 'indexer_preview_unavailable' };
  }
  const allowedType = allowlistedPreviewContentType(contentType);
  if (!allowedType) {
    return { ok: false, status: 415, error: 'indexer_preview_content_type_rejected' };
  }
  const binary = Buffer.from(bytesBase64, 'base64');
  return { ok: true, contentType: allowedType, bytes: new Uint8Array(binary) };
}

export async function readIndexerObjects(options: {
  readonly topicId?: string;
  readonly includeCaptures?: boolean;
}): Promise<IndexerRead> {
  const result = await callHarnessGraphql(INDEXER_OBJECTS_QUERY, {
    topicId: options.topicId ?? null,
    includeCaptures: options.includeCaptures ?? Boolean(options.topicId),
  });
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: indexerError(result.error),
    };
  }
  return {
    ok: true,
    tenant: result.principal.tenant,
    objects: objectsFromPayload(result.data),
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function indexerError(error: string): string {
  const suffix = error.match(/^harness_graphql_(failed|timeout|unconfigured|unreachable)$/)?.[1];
  return suffix ? `indexer_graphql_${suffix}` : error;
}
