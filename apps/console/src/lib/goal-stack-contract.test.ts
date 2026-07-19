import { describe, expect, it } from 'vitest';
import {
  applyPlanEvent,
  normalizeCapabilities,
  normalizePlanSnapshot,
  planIsComplete,
} from '@commonplace/theorem-acp/plan-state';
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
  });

  it('preserves capability annotations for admission-aware drag and drop', () => {
    const capabilities = normalizeCapabilities({
      capabilities: [{
        id: 'github:delete_file',
        title: 'Delete file',
        description: 'Delete one file',
        server_origin: 'github',
        annotations: ['destructive'],
      }],
    });
    expect(capabilities).toEqual([
      expect.objectContaining({
        id: 'github:delete_file',
        annotations: { readOnly: false, destructive: true },
      }),
    ]);
  });
});
