import { describe, expect, it, vi } from 'vitest';
import {
  fetchWorkspaceSurface,
  readinessIsBuilding,
  workspaceTreeRows,
  type ProjectTree,
} from '@commonplace/theorem-acp/workspace-state';

const TREE: ProjectTree = {
  projectId: 'project:fixture',
  generation: 3,
  roots: [{
    id: 'project:fixture',
    kind: 'project',
    name: 'Fixture',
    path: null,
    excluded: false,
    children: [{
      id: 'root:fixture',
      kind: 'content_root',
      name: 'fixture',
      path: '/tmp/fixture',
      excluded: false,
      children: [{
        id: 'excluded:target',
        kind: 'excluded',
        name: 'target',
        path: '/tmp/fixture/target',
        excluded: true,
        children: [],
      }],
    }],
  }],
};

describe('workspace substrate projection', () => {
  it('renders typed hierarchy only when its parents are expanded', () => {
    const collapsed = workspaceTreeRows(TREE, new Set());
    expect(collapsed.rows.map((row) => row.id)).toEqual(['project:fixture']);
    const expanded = workspaceTreeRows(TREE, new Set(['project:fixture', 'root:fixture']));
    expect(expanded.rows.map((row) => [row.id, row.depth, row.node.excluded])).toEqual([
      ['project:fixture', 1, false],
      ['root:fixture', 2, false],
      ['excluded:target', 3, true],
    ]);
  });

  it('keeps Building honest and sends the semantic GraphQL query', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      data: {
        projectTree: TREE,
        readiness: {
          generation: 3,
          capabilities: [{ capability: 'find', state: 'building', missing: ['trigram'] }],
        },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const surface = await fetchWorkspaceSurface('project:fixture', { fetchImpl });
    expect(readinessIsBuilding(surface.readiness)).toBe(true);
    expect(String(fetchImpl.mock.calls[0][1]?.body)).toContain('projectTree');
    expect(String(fetchImpl.mock.calls[0][1]?.body)).toContain('readiness');
  });
});
