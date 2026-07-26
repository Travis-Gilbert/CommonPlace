// SOURCING: none. Route path ↔ surface kind map for console Places and
// derived Collections (SPEC-CONSOLE-INFORMATION-ARCHITECTURE-1.0).

import { deriveLayoutCollections, PLACE_ENTRIES } from '@/lib/rail/rail-model';

const PLACE_ROUTES = PLACE_ENTRIES.map((place) => ({
  kind: place.kind,
  path: place.path,
  surfaceId: place.surfaceId,
  tier: 'place' as const,
}));

const COLLECTION_ROUTES = deriveLayoutCollections().map((collection) => ({
  kind: collection.kind,
  path: collection.path,
  surfaceId: collection.surfaceId,
  tier: 'collection' as const,
}));

/** Legacy App Router segments for surfaces that left the launch rail (CS11). */
const LEGACY_PLACE_ROUTES = [
  { kind: 'chat', path: '/chat', surfaceId: 'console-chat', tier: 'place' as const },
  { kind: 'workspace', path: '/workspace', surfaceId: 'console-workspace', tier: 'place' as const },
  { kind: 'index', path: '/filing', surfaceId: 'console-index', tier: 'place' as const },
  { kind: 'canvas', path: '/canvas', surfaceId: 'console-canvas', tier: 'place' as const },
  { kind: 'automation', path: '/automation', surfaceId: 'console-automation', tier: 'place' as const },
  { kind: 'survey', path: '/indexer', surfaceId: 'console-survey', tier: 'place' as const },
  { kind: 'model', path: '/models', surfaceId: 'console-models', tier: 'place' as const },
] as const;

/** Surfaces that own an App Router segment (launch views + legacy places + collections). */
export const SURFACE_ROUTES = [...PLACE_ROUTES, ...LEGACY_PLACE_ROUTES, ...COLLECTION_ROUTES] as const;

export type SurfaceRouteKind = (typeof SURFACE_ROUTES)[number]['kind'];

export function pathForSurfaceKind(kind: string): string | null {
  return SURFACE_ROUTES.find((route) => route.kind === kind)?.path ?? null;
}

export function surfaceIdForPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return SURFACE_ROUTES.find((route) => route.path === normalized)?.surfaceId ?? null;
}

export function kindForSurfaceId(surfaceId: string): string | null {
  return SURFACE_ROUTES.find((route) => route.surfaceId === surfaceId)?.kind ?? null;
}

export function tierForSurfaceId(surfaceId: string): 'place' | 'collection' | null {
  return SURFACE_ROUTES.find((route) => route.surfaceId === surfaceId)?.tier ?? null;
}
