// SOURCING: none. SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0 workspace object types.
/**
 * Workspace graph object (WT2/WT4). Pure types; persistence lands with the API.
 */

export type WorkspaceState =
  | 'pending_install'
  | 'provisioning'
  | 'ready'
  | 'revoked'
  | 'deleted';

export type WorkspaceObject = {
  readonly id: string;
  readonly tenant: string;
  readonly repoFullName: string;
  readonly installationId: number;
  readonly ref: string;
  /** Absolute path on the workspace volume: /workspace/{id} */
  readonly path: string;
  readonly state: WorkspaceState;
};

export function workspacePath(workspaceId: string, root = '/workspace'): string {
  const id = workspaceId.trim();
  if (!id || id.includes('/') || id.includes('..')) {
    throw new Error('invalid workspace id');
  }
  return `${root.replace(/\/$/, '')}/${id}`;
}
