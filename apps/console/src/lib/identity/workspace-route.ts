import type { IdentityWorkspace } from './contracts';

export type WorkspaceRouteResolution =
  | { readonly kind: 'resolved'; readonly workspace: IdentityWorkspace }
  | { readonly kind: 'ambiguous' }
  | { readonly kind: 'missing' };

/**
 * Workspace IDs are canonical route references. A slug remains a compatibility
 * alias only when it names exactly one workspace in the signed-in session.
 */
export function resolveIdentityWorkspaceRoute(
  workspaces: readonly IdentityWorkspace[],
  routeRef: string,
): WorkspaceRouteResolution {
  const byId = workspaces.find((workspace) => workspace.id === routeRef);
  if (byId) return { kind: 'resolved', workspace: byId };

  const bySlug = workspaces.filter((workspace) => workspace.slug === routeRef);
  if (bySlug.length === 1) {
    return { kind: 'resolved', workspace: bySlug[0]! };
  }
  return { kind: bySlug.length > 1 ? 'ambiguous' : 'missing' };
}
