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
];

/** A mock harness MCP endpoint returning a JSON-RPC tools/call result whose
 *  content is the GraphQL `{ data: { workGraph: {...} } }` envelope. */
function mcpFetch(workGraph: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      jsonrpc: '2.0',
      id: 'test',
      result: { content: [{ type: 'text', text: JSON.stringify({ data: { workGraph } }) }] },
    }),
  })) as unknown as typeof fetch;
}

const NOW = new Date('2026-07-06T00:00:00.000Z');

describe('Operator live workGraph mapping (PT-010)', () => {
  it('returns null when no run is selected (fixtures win)', async () => {
    const state = await buildOperatorStateLive({} as NodeJS.ProcessEnv, NOW, mcpFetch({ ok: true, tasks: TASK_NODES }));
    expect(state).toBeNull();
  });

  it('returns null and fails open when the backend is unreachable', async () => {
    const failing = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })) as unknown as typeof fetch;
    const state = await buildOperatorStateLive({ THEOREM_OPERATOR_RUN_ID: 'run-1' } as unknown as NodeJS.ProcessEnv, NOW, failing);
    expect(state).toBeNull();
  });

  it('maps TaskNode status → Operator status/lane faithfully', async () => {
    const state = await buildOperatorStateLive(
      { THEOREM_OPERATOR_RUN_ID: 'run-1' } as unknown as NodeJS.ProcessEnv,
      NOW,
      mcpFetch({ ok: true, tasks: TASK_NODES }),
    );
    expect(state).not.toBeNull();
    expect(state!.source.mode).toBe('live');

    const byId = Object.fromEntries(state!.tasks.map((t) => [t.id, t]));
    expect(byId['task-a']).toMatchObject({ status: 'claimed', lane: 'now', laneChip: 'implement' });
    expect(byId['task-b']).toMatchObject({ status: 'queued', lane: 'next' });
    expect(byId['task-c']).toMatchObject({ status: 'done', lane: 'done' });
  });

  it('binds claim.owner → head and granted_at → claimedAt', async () => {
    const state = await buildOperatorStateLive(
      { THEOREM_OPERATOR_RUN_ID: 'run-1' } as unknown as NodeJS.ProcessEnv,
      NOW,
      mcpFetch({ ok: true, tasks: TASK_NODES }),
    );
    const taskA = state!.tasks.find((t) => t.id === 'task-a')!;
    expect(taskA.claim).toEqual({ head: 'claude-code', claimedAt: new Date(1_000_000).toISOString() });
    expect(taskA.fileScope).toEqual(['apps/web/src/app/v2/operator/RunDrawer.tsx']);
    expect(taskA.runId).toBe('run-1');
    expect(taskA.ageMs).toBeGreaterThan(0);
  });

  it('resolves prerequisite goals and computes met from accepted nodes', async () => {
    const state = await buildOperatorStateLive(
      { THEOREM_OPERATOR_RUN_ID: 'run-1' } as unknown as NodeJS.ProcessEnv,
      NOW,
      mcpFetch({ ok: true, tasks: TASK_NODES }),
    );
    const taskB = state!.tasks.find((t) => t.id === 'task-b')!;
    expect(taskB.prerequisites).toEqual([
      { taskId: 'task-c', goal: 'OP2 queue', met: true }, // task-c is accepted
      { taskId: 'task-a', goal: 'Ship OP4 drawer', met: false }, // task-a is only claimed
    ]);
  });

  it('assigns claimed now-tasks to their head bay, leaves others empty', async () => {
    const state = await buildOperatorStateLive(
      { THEOREM_OPERATOR_RUN_ID: 'run-1' } as unknown as NodeJS.ProcessEnv,
      NOW,
      mcpFetch({ ok: true, tasks: TASK_NODES }),
    );
    const bayByHead = Object.fromEntries(state!.bays.map((b) => [b.head, b]));
    expect(bayByHead['claude-code'].task?.id).toBe('task-a');
    expect(bayByHead['claude-code'].prLight).toBe('open');
    expect(bayByHead['codex'].task).toBeNull();
  });
});
