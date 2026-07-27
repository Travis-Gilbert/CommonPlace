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

/** Secondary page-owned routes that are not launch places or collections. */
const AUXILIARY_ROUTES = [
  { kind: 'canvas', path: '/canvas', surfaceId: 'console-canvas', tier: 'place' as const },
  { kind: 'automation', path: '/automation', surfaceId: 'console-automation', tier: 'place' as const },
  { kind: 'appearance', path: '/appearance', surfaceId: 'console-appearance', tier: 'place' as const },
] as const;

/** Surfaces composed by an App Router page. Blocks never own these routes. */
export const SURFACE_ROUTES = [...PLACE_ROUTES, ...AUXILIARY_ROUTES, ...COLLECTION_ROUTES] as const;

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

export function pathForSurfaceId(surfaceId: string): string | null {
  return SURFACE_ROUTES.find((route) => route.surfaceId === surfaceId)?.path ?? null;
}

export function tierForSurfaceId(surfaceId: string): 'place' | 'collection' | null {
  return SURFACE_ROUTES.find((route) => route.surfaceId === surfaceId)?.tier ?? null;
}
