import { describe, expect, it } from 'vitest';

import { parseTaskNode, parseWorkGraphTasks, toNodeStatus } from '@/lib/theorem-harness-schema';

/**
 * These lock the ONE place the frontend mirrors the harness wire contract. A raw
 * `TaskNode` (serde snake_case, from `work_graph.rs` / `lib.rs:13230`) must round
 * through the parser into typed fields; malformed input must degrade, not throw.
 */
const RAW_TASK_NODE = {
  id: 'task-a',
  run_id: 'run-1',
  parent_id: null,
  node_type: 'implement',
  goal: 'Ship OP4 drawer',
  prerequisites: ['task-c'],
  file_scope: ['apps/web/src/app/(console)/operator/RunDrawer.tsx'],
  status: 'claimed',
  claim: { owner: 'claude-code', epoch: 3, granted_at: 1_000_000, expires_at: 9_000_000, last_heartbeat: 1_500_000 },
  claim_epoch: 3,
  receipts: [
    { kind: 'test', command: 'vitest run', base_commit: 'abc', claimed_status: 'pass', verified_status: 'pass', artifact_hash: '' },
  ],
  created_by: 'claude-code',
  review_required_by: 'codex',
};

describe('theorem-harness-schema parser', () => {
  it('parses a raw serde TaskNode into typed fields', () => {
    const node = parseTaskNode(RAW_TASK_NODE);
    expect(node).not.toBeNull();
    expect(node).toMatchObject({
      id: 'task-a',
      run_id: 'run-1',
      node_type: 'implement',
      goal: 'Ship OP4 drawer',
      prerequisites: ['task-c'],
      file_scope: ['apps/web/src/app/(console)/operator/RunDrawer.tsx'],
      status: 'claimed',
      claim_epoch: 3,
      created_by: 'claude-code',
      review_required_by: 'codex',
    });
    expect(node!.claim).toEqual({
      owner: 'claude-code',
      epoch: 3,
      granted_at: 1_000_000,
      expires_at: 9_000_000,
      last_heartbeat: 1_500_000,
    });
    expect(node!.receipts).toHaveLength(1);
    expect(node!.receipts[0]).toMatchObject({ kind: 'test', verified_status: 'pass' });
  });

  it('unwraps the singular-mutation { task: TaskNode } shape', () => {
    const node = parseTaskNode({ ok: true, reused: false, task: RAW_TASK_NODE });
    expect(node?.id).toBe('task-a');
    expect(node?.status).toBe('claimed');
  });

  it('parses the typed GraphQL TaskNode selection shape', () => {
    const node = parseTaskNode({
      id: 'task-a',
      runId: 'run-1',
      parentId: null,
      nodeType: 'implement',
      goal: 'Ship OP4 drawer',
      prerequisites: ['task-c'],
      fileScope: ['apps/web/src/app/(console)/operator/RunDrawer.tsx'],
      status: 'claimed',
      claim: { owner: 'claude-code', epoch: 3, grantedAt: 1_000_000, expiresAt: 9_000_000, lastHeartbeat: 1_500_000 },
      claimEpoch: 3,
      receipts: [
        { kind: 'test', command: 'vitest run', baseCommit: 'abc', claimedStatus: 'pass', verifiedStatus: 'pass', artifactHash: '' },
      ],
      createdBy: 'claude-code',
      reviewRequiredBy: 'codex',
    });
    expect(node).toMatchObject({
      id: 'task-a',
      run_id: 'run-1',
      node_type: 'implement',
      file_scope: ['apps/web/src/app/(console)/operator/RunDrawer.tsx'],
      claim_epoch: 3,
      created_by: 'claude-code',
      review_required_by: 'codex',
    });
    expect(node?.claim?.granted_at).toBe(1_000_000);
    expect(node?.receipts[0]?.artifact_hash).toBe('');
  });

  it('coerces an unknown/absent status to open (kernel initial state)', () => {
    expect(toNodeStatus('nonsense')).toBe('open');
    expect(toNodeStatus(undefined)).toBe('open');
    expect(toNodeStatus('ACCEPTED')).toBe('accepted'); // case-insensitive
    expect(parseTaskNode({ id: 'x' })?.status).toBe('open');
  });

  it('treats a null / owner-less claim as no hold', () => {
    expect(parseTaskNode({ id: 'x', claim: null })?.claim).toBeNull();
    expect(parseTaskNode({ id: 'x', claim: { epoch: 1 } })?.claim).toBeNull();
  });

  it('drops non-object entries from a tasks array without throwing', () => {
    const nodes = parseWorkGraphTasks([RAW_TASK_NODE, null, 42, 'nope', { id: 'task-b', status: 'open' }]);
    expect(nodes.map((n) => n.id)).toEqual(['task-a', 'task-b']);
  });

  it('returns [] for a non-array tasks value (fail-open)', () => {
    expect(parseWorkGraphTasks(undefined)).toEqual([]);
    expect(parseWorkGraphTasks({})).toEqual([]);
  });
});
