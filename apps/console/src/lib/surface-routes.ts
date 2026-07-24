// SOURCING: none. Route path ↔ surface kind map for HANDOFF-CONSOLE-BLOCK-SYSTEM B3.

/** Surfaces that own an App Router segment. Goals stays client-only until its route handoff. */
export const SURFACE_ROUTES = [
  { kind: 'chat', path: '/chat', surfaceId: 'console-chat' },
  { kind: 'workspace', path: '/workspace', surfaceId: 'console-workspace' },
  { kind: 'index', path: '/filing', surfaceId: 'console-index' },
  { kind: 'model', path: '/models', surfaceId: 'console-models' },
  { kind: 'documents', path: '/documents', surfaceId: 'console-docs' },
  { kind: 'cards', path: '/cards', surfaceId: 'console-cards' },
] as const;

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
