import { describe, expect, it } from 'vitest';
import {
  applyPlanEvent,
  normalizeCapabilities,
  normalizePlanSnapshot,
  planIsComplete,
  reportedEdgeProgress,
} from '@commonplace/theorem-acp/plan-state';
import { computePlanPath } from '@commonplace/theorem-acp/plan-path';
import { extractParamCandidates } from '@commonplace/theorem-acp/plan-params';
import { edgeProgress } from '@/views/goal-stack/plan-layout';

describe('Goal Stack shared projection', () => {
  it('normalizes the canonical plan and folds lifecycle events', () => {
    const snapshot = normalizePlanSnapshot({
      plan_id: 'plan:fixture',
      plan: {
        id: 'plan:fixture',
        title: 'Fixture goal',
        objective: 'Prove the substrate',
        acceptance_criteria: [{ criterion_id: 'c1', statement: 'The task verifies' }],
      },
      tasks: [{
        id: 'task:verify',
        title: 'Verify it',
        kind: 'verify',
        status: 'blocked',
        serves: ['c1'],
        claim_holder: 'github:owner',
        actor: 'codex',
        progress_fraction: 0.4,
        changed_paths: ['/repo/README.md'],
        changed_events: [{
          generation: 4,
          event: { kind: 'moved', from: '/repo/old.ts', to: '/repo/new.ts' },
        }],
      }],
    });
    expect(snapshot?.tasks[0]).toMatchObject({
      kind: 'verify',
      status: 'blocked',
      serves: ['c1'],
      claimHolder: 'github:owner',
      actor: 'codex',
      progressFraction: 0.4,
      changedEvents: [
        { path: '/repo/old.ts', generation: 4 },
        { path: '/repo/new.ts', generation: 4 },
      ],
    });
    const next = applyPlanEvent(snapshot!, {
      id: 'event:1',
      transition: 'task_completed',
      nodeIds: ['task:verify'],
      actor: 'codex',
      graphVersion: 4,
      at: '2026-07-18T00:00:00Z',
      detail: { status: 'verified' },
    });
    expect(next.tasks[0].status).toBe('verified');
    expect(planIsComplete(next)).toBe(true);
    expect(edgeProgress('verified')).toBe(1);
    expect(reportedEdgeProgress({ status: 'running', progressFraction: 0.58 })).toBe(0.58);
    expect(reportedEdgeProgress({ status: 'running', progressFraction: null })).toBe(0);
  });

  it('preserves capability annotations and grant state for the four palette groups', () => {
    const capabilities = normalizeCapabilities({
      capabilities: [{
        id: 'github:delete_file',
        title: 'Delete file',
        description: 'Delete one file',
        server_origin: 'github',
        group: 'connectors',
        grant_state: 'locked',
        missing_capability: 'github.write',
        annotations: ['destructive'],
      }],
    });
    expect(capabilities).toEqual([
      expect.objectContaining({
        id: 'github:delete_file',
        group: 'connectors',
        grantState: 'locked',
        missingCapability: 'github.write',
        annotations: { readOnly: false, destructive: true },
      }),
    ]);
  });

  it('illuminates ancestor and descendant chains for Clew click-to-path', () => {
    const path = computePlanPath([
      { id: 'a', dependencies: [] },
      { id: 'b', dependencies: ['a'] },
      { id: 'c', dependencies: ['b'] },
      { id: 'd', dependencies: ['a'] },
    ], 'b');
    expect([...path.ancestorIds].sort()).toEqual(['a']);
    expect([...path.descendantIds].sort()).toEqual(['c']);
    expect(path.pathNodeIds.has('d')).toBe(false);
    expect(path.pathEdgeIds.has('dependency:a:b')).toBe(true);
    expect(path.pathEdgeIds.has('dependency:b:c')).toBe(true);
  });

  it('extracts promotion parameter candidates from literals and target refs', () => {
    const snapshot = normalizePlanSnapshot({
      plan_id: 'plan:promo',
      plan: { id: 'plan:promo', title: 'Promo', objective: 'x' },
      tasks: [{
        id: 'task:1',
        alias: 'wire',
        title: 'Wire "staging" to task:release',
        description: 'Bind theorem:fixture/path',
        status: 'verified',
      }],
    });
    const candidates = extractParamCandidates(snapshot!);
    expect(candidates.some((item) => item.value === 'staging' && item.kind === 'literal')).toBe(true);
    expect(candidates.some((item) => item.value === 'task:release' && item.kind === 'target_ref')).toBe(true);
    expect(candidates.some((item) => item.value === 'theorem:fixture/path')).toBe(true);
  });
});
