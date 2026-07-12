import { describe, expect, it, vi } from 'vitest';

import { buildOperatorStateLive } from '@/lib/theorem-operator-live';

/**
 * Task-node payloads mirror the authoritative serde shape of
 * `theorem-harness-core::work_graph::TaskNode` (snake_case): id, run_id,
 * node_type, goal, prerequisites[], file_scope[], status (NodeStatus:
 * open|claimed|patch_proposed|verifying|accepted|rejected), claim (ClaimLease:
 * owner/epoch/granted_at/expires_at/last_heartbeat), claim_epoch, receipts,
 * created_by. This is the contract the mapper must consume faithfully.
 */
const TASK_NODES = [
  {
    id: 'task-a',
    run_id: 'run-1',
    node_type: 'implement',
    goal: 'Ship OP4 drawer',
    prerequisites: [],
    file_scope: ['apps/web/src/app/v2/operator/RunDrawer.tsx'],
    status: 'claimed',
    claim: { owner: 'claude-code', epoch: 3, granted_at: 1_000_000, expires_at: 9_000_000, last_heartbeat: 1_500_000 },
    claim_epoch: 3,
    receipts: [],
    created_by: 'claude-code',
  },
  {
    id: 'task-b',
    run_id: 'run-1',
    node_type: 'verify',
    goal: 'OP5 gate',
    prerequisites: ['task-c', 'task-a'], // task-c accepted → met; task-a claimed → not met
    file_scope: [],
    status: 'open',
    claim: null,
    claim_epoch: 0,
    receipts: [],
    created_by: 'codex',
  },
  {
    id: 'task-c',
    run_id: 'run-1',
    node_type: 'implement',
    goal: 'OP2 queue',
    prerequisites: [],
    file_scope: [],
    status: 'accepted',
    claim: null,
    claim_epoch: 1,
    receipts: [],
    created_by: 'claude-code',
  },
  {
    id: 'task-d',
    run_id: 'run-1',
    node_type: 'verify',
    goal: 'Review gate',
    prerequisites: [],
    file_scope: ['apps/web/src/app/v2/operator/Gate.tsx'],
    status: 'patch_proposed',
    claim: null,
    claim_epoch: 2,
    receipts: [
      {
        kind: 'test',
        command: 'npm --prefix apps/web test -- operator',
        base_commit: 'abc123',
        claimed_status: 'pass',
        verified_status: 'pass',
        artifact_hash: 'sha256:ok',
      },
    ],
    created_by: 'codex',
  },
];

/**
 * A mock commonplace-api GraphQL endpoint. The Operator live source now posts
 * server-to-server directly to `THEOREM_GRAPHQL_URL` and reads a STANDARD
 * GraphQL response envelope (`{ data: { workGraph } }`) — no MCP JSON-RPC
 * `result.content[].text` wrapping. The returned spy lets tests assert the
 * request shape (endpoint, x-api-key, query, variables).
 */
function graphqlFetch(workGraph: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { workGraph } }),
  })) as unknown as typeof fetch;
}

const LIVE_ENV = {
  THEOREM_OPERATOR_RUN_ID: 'run-1',
  THEOREM_GRAPHQL_URL: 'https://commonplace-api.example',
  THEOREM_API_KEY: 'instance-key',
} as unknown as NodeJS.ProcessEnv;

const NOW = new Date('2026-07-06T00:00:00.000Z');

describe('Operator live workGraph mapping (PT-010)', () => {
  it('uses the aggregate workGraph when no run is selected', async () => {
    const spy = graphqlFetch({ ok: true, tasks: TASK_NODES });
    const state = await buildOperatorStateLive({ THEOREM_GRAPHQL_URL: 'https://commonplace-api.example' } as unknown as NodeJS.ProcessEnv, NOW, spy);
    expect(state).not.toBeNull();
    expect(state!.source.endpoint).toBe('https://commonplace-api.example/graphql · all runs');

    const [, init] = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> };
    expect(body.variables).toEqual({});
    expect(body.query).toContain('query OperatorWorkGraph($runId:String)');
  });

  it('returns null and fails open when the backend returns non-2xx', async () => {
    const failing = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })) as unknown as typeof fetch;
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, failing);
    expect(state).toBeNull();
  });

  it('returns null and fails open when the fetch throws (backend unreachable)', async () => {
    const throwing = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, throwing);
    expect(state).toBeNull();
  });

  it('posts the workGraph query to the commonplace-api GraphQL door with the server key', async () => {
    const spy = graphqlFetch({ ok: true, tasks: TASK_NODES });
    await buildOperatorStateLive(LIVE_ENV, NOW, spy);

    expect(spy).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    // Canonical HTTP door, NOT the harness MCP; normalized to end in /graphql.
    expect(endpoint).toBe('https://commonplace-api.example/graphql');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('instance-key');

    const body = JSON.parse(init.body as string) as { query: string; variables: { runId: string } };
    expect(body.variables).toEqual({ runId: 'run-1' });
    expect(body.query).toContain('workGraph(runId:$runId)');
    expect(body.query).toContain('query OperatorWorkGraph($runId:String)');
    // The opaque `graph` blob is retired — tasks IS the graph, typed.
    expect(body.query).not.toMatch(/^\s*graph\s*$/m);
  });

  it('maps TaskNode status → Operator status/lane faithfully', async () => {
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, graphqlFetch({ ok: true, tasks: TASK_NODES }));
    expect(state).not.toBeNull();
    expect(state!.source.mode).toBe('live');
    expect(state!.source.label).toBe('commonplace-api workGraph');

    const byId = Object.fromEntries(state!.tasks.map((t) => [t.id, t]));
    expect(byId['task-a']).toMatchObject({ status: 'claimed', lane: 'now', laneChip: 'implement' });
    expect(byId['task-b']).toMatchObject({ status: 'queued', lane: 'next' });
    expect(byId['task-c']).toMatchObject({ status: 'done', lane: 'done' });
    expect(byId['task-d']).toMatchObject({ status: 'review', lane: 'now', laneChip: 'verify' });
  });

  it('binds claim.owner → head and granted_at → claimedAt', async () => {
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, graphqlFetch({ ok: true, tasks: TASK_NODES }));
    const taskA = state!.tasks.find((t) => t.id === 'task-a')!;
    expect(taskA.claim).toEqual({ head: 'claude-code', claimedAt: new Date(1_000_000).toISOString() });
    expect(taskA.fileScope).toEqual(['apps/web/src/app/v2/operator/RunDrawer.tsx']);
    expect(taskA.runId).toBe('run-1');
    expect(taskA.ageMs).toBeGreaterThan(0);
  });

  it('resolves prerequisite goals and computes met from accepted nodes', async () => {
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, graphqlFetch({ ok: true, tasks: TASK_NODES }));
    const taskB = state!.tasks.find((t) => t.id === 'task-b')!;
    expect(taskB.prerequisites).toEqual([
      { taskId: 'task-c', goal: 'OP2 queue', met: true }, // task-c is accepted
      { taskId: 'task-a', goal: 'Ship OP4 drawer', met: false }, // task-a is only claimed
    ]);
  });

  it('assigns claimed now-tasks to their head bay, leaves others empty', async () => {
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, graphqlFetch({ ok: true, tasks: TASK_NODES }));
    const bayByHead = Object.fromEntries(state!.bays.map((b) => [b.head, b]));
    expect(bayByHead['claude-code'].task?.id).toBe('task-a');
    expect(bayByHead['claude-code'].prLight).toBe('open');
    expect(bayByHead['codex'].task).toBeNull();
  });

  it('derives live gate, shift, and drawer state from TaskNodes', async () => {
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, graphqlFetch({ ok: true, tasks: TASK_NODES }));
    expect(state!.gate).toHaveLength(1);
    expect(state!.gate[0]).toMatchObject({
      taskId: 'task-d',
      owner: 'codex',
      commits: [{ sha: 'abc123', message: 'npm --prefix apps/web test -- operator' }],
    });
    expect(state!.gate[0].acceptance).toEqual([
      {
        id: 'receipt_1',
        label: 'npm --prefix apps/web test -- operator',
        met: true,
        evidence: { label: 'sha256:ok' },
      },
    ]);

    expect(state!.drawers['task-a']).toMatchObject({
      taskId: 'task-a',
      live: true,
      footprint: ['apps/web/src/app/v2/operator/RunDrawer.tsx'],
    });
    expect(state!.drawers['task-a'].events[0]).toMatchObject({ kind: 'claim', actor: 'claude-code' });

    expect(state!.shiftSummary).toMatchObject({
      completed: [{ taskId: 'task-c', goal: 'OP2 queue', gateStatus: 'passed' }],
      reviewReadyCount: 1,
      queueDepth: 1,
      urgentMessages: [],
    });
    expect(state!.shiftSummary.newlyBlocked.map((task) => task.taskId)).toEqual(['task-b']);
    // Rollup window matches the fixture contract: 12h lookback from `now`.
    expect(state!.shiftSummary.since).toBe(new Date(NOW.getTime() - 12 * 60 * 60 * 1000).toISOString());
  });

  it('fails open to fixtures when the GraphQL response carries errors (no data.workGraph)', async () => {
    const errored = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: 'Cannot query field "workGraph"' }] }),
    })) as unknown as typeof fetch;
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, errored);
    expect(state).toBeNull();
  });
});
