// SOURCING: none. Pure helpers for Indexer object projection from Theorem.

import type { JsonValue, ObjectRef, ObjectQuery, Predicate } from '@commonplace/block-view/types';
import { surveyModelFromObjects } from '@/views/survey/surveyContract';

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

/**
 * Parse a live Indexer payload.
 * Returns `null` when the payload is invalid so callers can fall back to seed.
 * Returns an array (including empty) when the live response is authoritative.
 */
export function parseIndexerObjectsPayload(payload: unknown): ObjectRef[] | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const objects = (payload as { objects?: unknown }).objects;
  if (!Array.isArray(objects)) return null;
  return objects.filter(isObjectRef).map((object) => ({
    id: object.id,
    type: object.type,
    properties: object.properties as Record<string, JsonValue>,
  }));
}

export function filterIndexerObjects(
  objects: readonly ObjectRef[],
  query: ObjectQuery,
  matchesPredicate: (object: ObjectRef, predicate: Predicate | undefined) => boolean,
): ObjectRef[] {
  return objects.filter(
    (object) => query.types.includes(object.type) && matchesPredicate(object, query.where),
  );
}

/** Prove a projected payload is console-readable without renaming fields. */
export function indexerProjectionIsReadable(objects: readonly ObjectRef[]): boolean {
  const model = surveyModelFromObjects(objects);
  if (objects.some((object) => object.type === 'capture')) {
    return model.topic !== null && model.captures.length > 0;
  }
  return objects.some((object) => object.type === 'topic');
}
