// SOURCING: none. Pure logic, no upstream component applies.
/**
 * Surface tree mechanics, extracted verbatim from
 * apps/web/src/components/commonplace/surface (SurfaceRenderer.tsx module
 * functions plus surface/types.ts constants). The arrangement is data: a
 * `surface` object CONTAINS `region` objects CONTAINS `view-instance`
 * objects, and this module walks those relations into a render tree.
 * Extraction mirrors, never widens: the shapes and semantics here are the
 * ones the web SurfaceRenderer already renders.
 */

import type { ObjectQuery, ObjectRef } from './types';

export const CONTAINS_EDGE = 'CONTAINS';

export interface SurfaceTreeNode {
  readonly object: ObjectRef;
  readonly children: readonly SurfaceTreeNode[];
}

export function buildSurfaceTree(surfaceId: string, objects: readonly ObjectRef[]): SurfaceTreeNode | null {
  const map = new Map(objects.map((object) => [object.id, object]));
  return buildNode(surfaceId, map, new Set());
}

function buildNode(
  id: string,
  map: ReadonlyMap<string, ObjectRef>,
  visited: Set<string>,
): SurfaceTreeNode | null {
  const object = map.get(id);
  if (!object || visited.has(id)) return null;
  visited.add(id);
  const children = (object.relations?.[CONTAINS_EDGE] ?? [])
    .map((childId) => buildNode(childId, map, visited))
    .filter((node): node is SurfaceTreeNode => node !== null);
  visited.delete(id);
  return { object, children };
}

/** The query that loads a whole arrangement: surface, regions, view instances. */
export function surfaceQuery(): ObjectQuery {
  return {
    types: ['surface', 'region', 'view-instance'],
    traverse: [{ edge: CONTAINS_EDGE, dir: 'out' }],
    live: true,
  };
}
