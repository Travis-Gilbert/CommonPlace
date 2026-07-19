import path from 'node:path';
import { forward } from '@/app/api/objects/_upstream';

export const dynamic = 'force-dynamic';

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

const OPERATIONS: Readonly<Record<string, string>> = {
  WorkspaceSurface: `query WorkspaceSurface($projectId: String!) {
    projectTree(projectId: $projectId) { projectId generation roots { ${NODE_FIELDS} } }
    readiness { generation capabilities { capability state missing } }
  }`,
  WorkspaceReadiness: 'query WorkspaceReadiness { readiness { generation capabilities { capability state missing } } }',
  WorkspaceProjectFind: `query WorkspaceProjectFind($query: String!, $projectId: String!) {
    search(query: $query, k: 12, projectId: $projectId) {
      item { id kind title path }
      score originalScore insideProject degraded missingIndexes
    }
  }`,
  WorkspaceFileHistory: `query WorkspaceFileHistory($path: String!) {
    fileHistory(path: $path) { path revisions { generation hash label timestampMs content } }
  }`,
  CreateWorkspaceProject: `mutation CreateWorkspaceProject($name: String!, $rootPath: String!) {
    createProject(name: $name, rootPath: $rootPath) { projectId rootId rootPath generation }
  }`,
  AddWorkspaceContentRoot: `mutation AddWorkspaceContentRoot($projectId: String!, $rootPath: String!) {
    addContentRoot(projectId: $projectId, rootPath: $rootPath) { projectId rootId rootPath generation }
  }`,
  RestoreWorkspaceRevision: `mutation RestoreWorkspaceRevision($path: String!, $generation: Int!) {
    restoreRevision(path: $path, generation: $generation) {
      path revisions { generation hash label timestampMs content }
    }
  }`,
};

export async function POST(request: Request): Promise<Response> {
  const body = record(await request.json().catch(() => null));
  const query = typeof body?.query === 'string' ? body.query : '';
  const operation = /\b(?:query|mutation)\s+([A-Za-z][A-Za-z0-9_]*)\b/.exec(query)?.[1];
  const canonical = operation ? OPERATIONS[operation] : undefined;
  if (!operation || !canonical) return Response.json({ error: 'workspace_operation_not_allowed' }, { status: 400 });
  const variables = record(body?.variables) ?? {};
  const variableError = validateVariables(operation, variables);
  if (variableError) return variableError;
  return forward('/graphql', {
    method: 'POST',
    body: JSON.stringify({ operationName: operation, query: canonical, variables }),
  });
}

function validateVariables(operation: string, variables: Record<string, unknown>): Response | null {
  const bounded = (name: string, maximum = 512) => {
    const value = variables[name];
    return typeof value === 'string' && value.trim() && value.length <= maximum;
  };
  if (operation === 'WorkspaceReadiness') return null;
  if (operation === 'WorkspaceSurface' && bounded('projectId')) return null;
  if (operation === 'WorkspaceProjectFind' && bounded('projectId') && bounded('query', 4_096)) return null;
  if (operation === 'WorkspaceFileHistory' && allowedWorkspacePath(variables.path)) return null;
  if (operation === 'RestoreWorkspaceRevision'
    && allowedWorkspacePath(variables.path)
    && Number.isSafeInteger(variables.generation)
    && Number(variables.generation) >= 0) return null;
  if (operation === 'CreateWorkspaceProject'
    && bounded('name')
    && allowedWorkspacePath(variables.rootPath)) return null;
  if (operation === 'AddWorkspaceContentRoot'
    && bounded('projectId')
    && allowedWorkspacePath(variables.rootPath)) return null;
  return Response.json({ error: 'workspace_variables_invalid' }, { status: 400 });
}

function allowedWorkspacePath(value: unknown): boolean {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.length > 4_096 || value.includes('\0')) return false;
  const allowed = (process.env.CONSOLE_WORKSPACE_ALLOWED_ROOTS ?? '')
    .split(path.delimiter)
    .map((root) => root.trim())
    .filter(Boolean)
    .map((root) => path.resolve(root));
  if (allowed.length === 0) return process.env.NODE_ENV !== 'production';
  const candidate = path.resolve(value);
  return allowed.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`));
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
