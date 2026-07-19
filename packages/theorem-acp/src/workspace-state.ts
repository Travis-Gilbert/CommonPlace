/** Framework-free CommonPlace projection over the workspace GraphQL contract. */

export const WORKSPACE_SUBSTRATE_SCHEMA = 'commonplace.workspace-substrate/1' as const;

export interface WorkspaceTreeNode {
  id: string;
  kind: string;
  name: string;
  path: string | null;
  excluded: boolean;
  children: WorkspaceTreeNode[];
}

export interface ProjectTree {
  projectId: string;
  generation: number;
  roots: WorkspaceTreeNode[];
}

export interface ReadinessCapability {
  capability: string;
  state: string;
  missing: string[];
}

export interface WorkspaceReadiness {
  generation: number;
  capabilities: ReadinessCapability[];
}

export interface FileRevision {
  generation: number;
  hash: string;
  label: string | null;
  timestampMs: number;
  content: string | null;
}

export interface FileHistory {
  path: string;
  revisions: FileRevision[];
}

export interface ProjectImportReceipt {
  projectId: string;
  rootId: string;
  rootPath: string;
  generation: number;
}

export interface WorkspaceSearchHit {
  item: {
    id: string;
    kind: string;
    title: string;
    path: string | null;
  };
  score: number;
  originalScore: number;
  insideProject: boolean | null;
  degraded: boolean;
  missingIndexes: string[];
}

export interface WorkspaceSurfaceSnapshot {
  schema: typeof WORKSPACE_SUBSTRATE_SCHEMA;
  tree: ProjectTree;
  readiness: WorkspaceReadiness;
}

export interface WorkspaceTreeProjection {
  rows: WorkspaceTreeRow[];
  nodeById: ReadonlyMap<string, WorkspaceTreeNode>;
}

export interface WorkspaceTreeRow {
  id: string;
  node: WorkspaceTreeNode;
  depth: number;
  expandable: boolean;
}

export type WorkspaceGraphqlClientOptions = {
  endpoint?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

const NODE_FIELDS = `
  id kind name path excluded
  children {
    id kind name path excluded
    children {
      id kind name path excluded
      children {
        id kind name path excluded
        children { id kind name path excluded }
      }
    }
  }
`;

export async function fetchWorkspaceSurface(
  projectId: string,
  options: WorkspaceGraphqlClientOptions = {},
): Promise<WorkspaceSurfaceSnapshot> {
  const data = await graphql<{ projectTree: ProjectTree; readiness: WorkspaceReadiness }>(
    `query WorkspaceSurface($projectId: String!) {
      projectTree(projectId: $projectId) { projectId generation roots { ${NODE_FIELDS} } }
      readiness { generation capabilities { capability state missing } }
    }`,
    { projectId },
    options,
  );
  return { schema: WORKSPACE_SUBSTRATE_SCHEMA, tree: data.projectTree, readiness: data.readiness };
}

export async function fetchWorkspaceReadiness(
  options: WorkspaceGraphqlClientOptions = {},
): Promise<WorkspaceReadiness> {
  const data = await graphql<{ readiness: WorkspaceReadiness }>(
    'query WorkspaceReadiness { readiness { generation capabilities { capability state missing } } }',
    {},
    options,
  );
  return data.readiness;
}

export async function findInWorkspaceProject(
  query: string,
  projectId: string,
  options: WorkspaceGraphqlClientOptions = {},
): Promise<WorkspaceSearchHit[]> {
  const data = await graphql<{ search: WorkspaceSearchHit[] }>(
    `query WorkspaceProjectFind($query: String!, $projectId: String!) {
      search(query: $query, k: 12, projectId: $projectId) {
        item { id kind title path }
        score originalScore insideProject degraded missingIndexes
      }
    }`,
    { query, projectId },
    options,
  );
  return data.search;
}

export async function fetchFileHistory(
  path: string,
  options: WorkspaceGraphqlClientOptions = {},
): Promise<FileHistory> {
  const data = await graphql<{ fileHistory: FileHistory }>(
    `query WorkspaceFileHistory($path: String!) {
      fileHistory(path: $path) { path revisions { generation hash label timestampMs content } }
    }`,
    { path },
    options,
  );
  return data.fileHistory;
}

export async function createWorkspaceProject(
  name: string,
  rootPath: string,
  options: WorkspaceGraphqlClientOptions = {},
): Promise<ProjectImportReceipt> {
  const data = await graphql<{ createProject: ProjectImportReceipt }>(
    `mutation CreateWorkspaceProject($name: String!, $rootPath: String!) {
      createProject(name: $name, rootPath: $rootPath) { projectId rootId rootPath generation }
    }`,
    { name, rootPath },
    options,
  );
  return data.createProject;
}

export async function addWorkspaceContentRoot(
  projectId: string,
  rootPath: string,
  options: WorkspaceGraphqlClientOptions = {},
): Promise<ProjectImportReceipt> {
  const data = await graphql<{ addContentRoot: ProjectImportReceipt }>(
    `mutation AddWorkspaceContentRoot($projectId: String!, $rootPath: String!) {
      addContentRoot(projectId: $projectId, rootPath: $rootPath) { projectId rootId rootPath generation }
    }`,
    { projectId, rootPath },
    options,
  );
  return data.addContentRoot;
}

export async function restoreWorkspaceRevision(
  path: string,
  generation: number,
  options: WorkspaceGraphqlClientOptions = {},
): Promise<FileHistory> {
  const data = await graphql<{ restoreRevision: FileHistory }>(
    `mutation RestoreWorkspaceRevision($path: String!, $generation: Int!) {
      restoreRevision(path: $path, generation: $generation) {
        path revisions { generation hash label timestampMs content }
      }
    }`,
    { path, generation },
    options,
  );
  return data.restoreRevision;
}

export function workspaceTreeRows(
  tree: ProjectTree,
  expanded: ReadonlySet<string>,
): WorkspaceTreeProjection {
  const rows: WorkspaceTreeRow[] = [];
  const nodeById = new Map<string, WorkspaceTreeNode>();
  const visit = (node: WorkspaceTreeNode, depth: number) => {
    nodeById.set(node.id, node);
    rows.push({ id: node.id, node, depth, expandable: node.children.length > 0 });
    if (node.children.length > 0 && expanded.has(node.id)) {
      node.children.forEach((child) => visit(child, depth + 1));
    }
  };
  tree.roots.forEach((root) => visit(root, 1));
  return { rows, nodeById };
}

export function readinessIsBuilding(readiness: WorkspaceReadiness | null): boolean {
  if (!readiness) return true;
  return readiness.capabilities.some(
    (item) => item.state.toLowerCase() !== 'ready' || item.missing.length > 0,
  );
}

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  options: WorkspaceGraphqlClientOptions,
): Promise<T> {
  const response = await (options.fetchImpl ?? fetch)(options.endpoint ?? '/api/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: options.signal,
  });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  } | null;
  const error = body?.errors?.map((item) => item.message).filter(Boolean).join('; ');
  if (!response.ok || !body?.data || error) {
    throw new Error(error || `Workspace GraphQL request failed with ${response.status}.`);
  }
  return body.data;
}
