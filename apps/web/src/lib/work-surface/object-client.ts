import type { ObjectAction, ObjectActionReceipt, ObjectQuery, ObjectRef, ObjectShape, ViewDescriptor } from '@/lib/block-view/types';
import { commonPlaceInstanceProxyHeaders } from '@/lib/commonplace-instance';

/**
 * Thin fetch client for the SPEC-OBJECT-CONTRACT-V2 same-origin proxy routes
 * (api/theorem/objects/*). The wire response for a query is data-only (no
 * `subscribe` method, since a React callback cannot cross JSON); callers that
 * need a live ObjectSet (WS3's BlockHost) attach `subscribe` themselves.
 */
export interface ObjectSetWire {
  readonly objects: readonly ObjectRef[];
  readonly shape: ObjectShape;
  readonly next_cursor?: string;
  readonly notes?: readonly string[];
}

async function parseOrThrow(res: Response): Promise<unknown> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Objects backend returned HTTP ${res.status}.`;
    throw new Error(message);
  }
  return body;
}

export async function queryObjects(query: ObjectQuery): Promise<ObjectSetWire> {
  const res = await fetch('/api/theorem/objects/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...commonPlaceInstanceProxyHeaders() },
    body: JSON.stringify(query),
    cache: 'no-store',
  });
  return (await parseOrThrow(res)) as ObjectSetWire;
}

export async function emitObjectAction(action: ObjectAction): Promise<ObjectActionReceipt> {
  const res = await fetch('/api/theorem/objects/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...commonPlaceInstanceProxyHeaders() },
    body: JSON.stringify(action),
    cache: 'no-store',
  });
  return (await parseOrThrow(res)) as ObjectActionReceipt;
}

export async function fetchObjectViews(): Promise<readonly ViewDescriptor[]> {
  const res = await fetch('/api/theorem/objects/views', {
    method: 'GET',
    headers: { ...commonPlaceInstanceProxyHeaders() },
    cache: 'no-store',
  });
  return (await parseOrThrow(res)) as readonly ViewDescriptor[];
}

/** A fulltext ObjectQuery across every type, for the omnibar's live search. */
export function fulltextQuery(text: string, limit = 8): ObjectQuery {
  return {
    types: [],
    rank: [{ kind: 'fulltext', query: text }],
    page: { limit },
  };
}
