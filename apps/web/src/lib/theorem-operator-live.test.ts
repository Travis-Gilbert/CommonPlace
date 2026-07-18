import { describe, expect, it, vi } from 'vitest';

import { handleOperatorActionForState } from '@/lib/theorem-operator';
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
    file_scope: ['apps/web/src/app/(console)/operator/RunDrawer.tsx'],
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
    file_scope: ['apps/web/src/app/(console)/operator/Gate.tsx'],
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

function graphqlFetch(workGraph: unknown): typeof fetch {
  const view = workGraph && typeof workGraph === 'object' && !Array.isArray(workGraph)
    ? {
        run: { tenant_slug: 'Travis-Gilbert', run_id: 'run-1' },
        ...(workGraph as Record<string, unknown>),
      }
    : workGraph;
  return vi.fn(async () => new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: 'operator-test',
    result: { structuredContent: { data: { workGraph: view } } },
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
}

const LIVE_ENV = {
  THEOREM_OPERATOR_RUN_ID: 'run-1',
  THEOREM_MCP_URL: 'https://harness.example/mcp',
  THEOREM_MCP_AUTH_TOKEN: 'tenant-bound-token',
  THEOREM_TENANT_SLUG: 'Travis-Gilbert',
  THEOREM_OPERATOR_HEADS: 'claude-code,codex',
} as unknown as NodeJS.ProcessEnv;

const NOW = new Date('2026-07-06T00:00:00.000Z');

describe('Operator live workGraph mapping (PT-010)', () => {
  it('requires the run-scoped workGraph contract', async () => {
    const spy = graphqlFetch({ ok: true, tasks: TASK_NODES });
    const state = await buildOperatorStateLive(
      {
        THEOREM_MCP_URL: 'https://harness.example/mcp',
        THEOREM_MCP_AUTH_TOKEN: 'tenant-bound-token',
        THEOREM_TENANT_SLUG: 'Travis-Gilbert',
      } as unknown as NodeJS.ProcessEnv,
      NOW,
      spy,
    );
    expect(state).toBeNull();
    expect(spy).not.toHaveBeenCalled();
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

  it('posts the typed workGraph query through the tenant-bound MCP GraphQL door', async () => {
    const spy = graphqlFetch({ ok: true, tasks: TASK_NODES });
    await buildOperatorStateLive(LIVE_ENV, NOW, spy);

    expect(spy).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://harness.example/mcp');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tenant-bound-token');

    const body = JSON.parse(init.body as string) as {
      params: { name: string; arguments: { query: string; variables: { runId: string } } };
    };
    expect(body.params.name).toBe('graphql_query');
    expect(body.params.arguments.variables).toEqual({ runId: 'run-1' });
    expect(body.params.arguments.query).toContain('workGraph(runId:$runId)');
    expect(body.params.arguments.query).toContain('query OperatorWorkGraph($runId:String!)');
    // The opaque `graph` blob is retired — tasks IS the graph, typed.
    expect(body.params.arguments.query).not.toMatch(/^\s*graph\s*$/m);
  });

  it('maps TaskNode status → Operator status/lane faithfully', async () => {
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, graphqlFetch({ ok: true, tasks: TASK_NODES }));
    expect(state).not.toBeNull();
    expect(state!.source.mode).toBe('live');
    expect(state!.source.label).toBe('Harness MCP workGraph');

    const byId = Object.fromEntries(state!.tasks.map((t) => [t.id, t]));
    expect(byId['task-a']).toMatchObject({ status: 'claimed', lane: 'now', laneChip: 'implement' });
    expect(byId['task-a'].claimEpoch).toBe(3);
    expect(byId['task-b']).toMatchObject({ status: 'queued', lane: 'next' });
    expect(byId['task-c']).toMatchObject({ status: 'done', lane: 'done' });
    expect(byId['task-d']).toMatchObject({ status: 'review', lane: 'now', laneChip: 'verify' });
  });

  it('rejects malformed and cross-run task payloads instead of producing a live empty board', async () => {
    const wrongRun = await buildOperatorStateLive(
      LIVE_ENV,
      NOW,
      graphqlFetch({
        ok: true,
        run: { tenant_slug: 'Travis-Gilbert', run_id: 'run-1' },
        tasks: [{ ...TASK_NODES[0], run_id: 'run-2' }],
      }),
    );
    const malformed = await buildOperatorStateLive(
      LIVE_ENV,
      NOW,
      graphqlFetch({ ok: true, tasks: {} }),
    );
    const partial = await buildOperatorStateLive(
      LIVE_ENV,
      NOW,
      graphqlFetch({ ok: true, tasks: [{ id: 'task-partial', runId: 'run-1' }] }),
    );
    const malformedReceipt = await buildOperatorStateLive(
      LIVE_ENV,
      NOW,
      graphqlFetch({
        ok: true,
        tasks: [{
          ...TASK_NODES[3],
          receipts: [{ claimed_status: 'pass', verified_status: 'pass' }],
        }],
      }),
    );
    const unsafeEpoch = await buildOperatorStateLive(
      LIVE_ENV,
      NOW,
      graphqlFetch({ ok: true, tasks: [{ ...TASK_NODES[1], claim_epoch: -1 }] }),
    );
    const coercedEpoch = await buildOperatorStateLive(
      LIVE_ENV,
      NOW,
      graphqlFetch({ ok: true, tasks: [{ ...TASK_NODES[1], claim_epoch: '0' }] }),
    );

    expect(wrongRun).toBeNull();
    expect(malformed).toBeNull();
    expect(partial).toBeNull();
    expect(malformedReceipt).toBeNull();
    expect(unsafeEpoch).toBeNull();
    expect(coercedEpoch).toBeNull();
  });

  it('binds claim.owner → head and granted_at → claimedAt', async () => {
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, graphqlFetch({ ok: true, tasks: TASK_NODES }));
    const taskA = state!.tasks.find((t) => t.id === 'task-a')!;
    expect(taskA.claim).toEqual({ head: 'claude-code', claimedAt: new Date(1_000_000).toISOString() });
    expect(taskA.fileScope).toEqual(['apps/web/src/app/(console)/operator/RunDrawer.tsx']);
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

  it('validates actions against the live Operator state, not fixture task ids', async () => {
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, graphqlFetch({ ok: true, tasks: TASK_NODES }));
    expect(state).not.toBeNull();

    const result = handleOperatorActionForState(
      { action: 'reorder_queue', taskId: 'task-b', priority: 0 },
      state!,
    );

    expect(result).toMatchObject({
      ok: true,
      action: 'reorder_queue',
      message: 'Priority of "OP5 gate" written to 0.',
    });
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
      footprint: ['apps/web/src/app/(console)/operator/RunDrawer.tsx'],
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

  it('returns null when the MCP GraphQL response carries errors', async () => {
    const errored = vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: 'operator-test',
      result: { structuredContent: { errors: [{ message: 'Cannot query field "workGraph"' }] } },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    const state = await buildOperatorStateLive(LIVE_ENV, NOW, errored);
    expect(state).toBeNull();
  });
});
