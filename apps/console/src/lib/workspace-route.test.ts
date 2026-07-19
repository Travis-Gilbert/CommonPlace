import { afterEach, describe, expect, it, vi } from 'vitest';

const { forwardMock } = vi.hoisted(() => ({ forwardMock: vi.fn() }));
vi.mock('@/app/api/objects/_upstream', () => ({ forward: forwardMock }));

import { POST } from '@/app/api/workspace/route';

function request(query: string, variables: Record<string, unknown> = {}) {
  return new Request('https://console.test/api/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
}

describe('workspace same-origin route', () => {
  afterEach(() => {
    forwardMock.mockReset();
    vi.unstubAllEnvs();
  });

  it('rejects documents outside the workspace operation allowlist', async () => {
    const response = await POST(request('mutation DeleteEverything { deleteAll }'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'workspace_operation_not_allowed' });
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it('rebuilds an allowed operation server-side and drops injected fields', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CONSOLE_WORKSPACE_ALLOWED_ROOTS', '/srv/workspaces');
    forwardMock.mockResolvedValue(new Response('{}'));
    const response = await POST(request(
      'mutation CreateWorkspaceProject($name:String!,$rootPath:String!){ createProject(name:$name,rootPath:$rootPath){projectId} deleteAll }',
      { name: 'Fixture', rootPath: '/srv/workspaces/fixture' },
    ));
    expect(response.status).toBe(200);
    const forwarded = forwardMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(forwarded.body)) as { operationName: string; query: string };
    expect(body.operationName).toBe('CreateWorkspaceProject');
    expect(body.query).toContain('createProject');
    expect(body.query).not.toContain('deleteAll');
  });

  it('refuses production paths outside the configured root', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CONSOLE_WORKSPACE_ALLOWED_ROOTS', '/srv/workspaces');
    const response = await POST(request(
      'mutation AddWorkspaceContentRoot($projectId:String!,$rootPath:String!){ addContentRoot(projectId:$projectId,rootPath:$rootPath){projectId} }',
      { projectId: 'project:fixture', rootPath: '/etc' },
    ));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'workspace_variables_invalid' });
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
