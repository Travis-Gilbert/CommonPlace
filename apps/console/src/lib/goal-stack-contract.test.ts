import { describe, expect, it } from 'vitest';
import {
  applyPlanEvent,
  normalizeCapabilities,
  normalizePlanPoll,
  normalizePlanSnapshot,
  planIsComplete,
  reportedEdgeProgress,
} from '@commonplace/theorem-acp/plan-state';
import { computePlanPath } from '@commonplace/theorem-acp/plan-path';
import { applyParamBindings, extractParamCandidates } from '@commonplace/theorem-acp/plan-params';
import {
  planToProgrammableGraph,
  sideEffectingAffordanceRefs,
} from '@commonplace/theorem-acp/plan-program';
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

  it('folds metadata events over fresh inspect snapshots and canonicalizes task node ids', () => {
    const previous = normalizePlanSnapshot({
      plan_id: 'plan:live',
      plan: { id: 'plan:live', title: 'Live', objective: 'x' },
      tasks: [{ id: 'task:a', alias: 'a', title: 'A', status: 'running' }],
      graph_version: 3,
    });
    const result = normalizePlanPoll({
      snapshot: {
        plan_id: 'plan:live',
        plan: { id: 'plan:live', title: 'Live', objective: 'x' },
        tasks: [{ id: 'task:a', alias: 'a', title: 'A', status: 'pending' }],
        graph_version: 4,
      },
      events: {
        rows: [{
          event_id: 'event:completed',
          transition: 'task_completed',
          node_ids: ['work-graph:run:live:node:task:a'],
          graph_version: 5,
          metadata: {
            task_reverts: {
              'task:a': { changed_paths: ['/repo/src/a.ts'] },
            },
          },
        }],
      },
      cursor: 5,
    }, previous);

    expect(result.snapshot.tasks[0].status).toBe('verified');
    expect(result.snapshot.tasks[0].changedEvents).toEqual([
      { path: '/repo/src/a.ts', generation: null, at: null },
    ]);
    expect(result.snapshot.streamCursor).toBe(5);
  });

  it('keeps fresh inspect state authoritative through its graph watermark', () => {
    const completed = normalizePlanPoll({
      snapshot: {
        plan_id: 'plan:watermark',
        plan: { id: 'plan:watermark', title: 'Watermark', objective: 'x' },
        tasks: [{ id: 'task:a', title: 'A', lifecycle_status: 'completed' }],
        graph_version: 5,
      },
      events: {
        rows: [{
          event_id: 'event:stale-claim',
          transition: 'task_claimed',
          task_id: 'task:a',
          graph_version: 5,
        }],
      },
    });
    expect(completed.snapshot.tasks[0].status).toBe('verified');
    expect(completed.snapshot.events.map((event) => event.id)).toContain('event:stale-claim');

    const raced = normalizePlanPoll({
      snapshot: {
        plan_id: 'plan:watermark',
        plan: { id: 'plan:watermark', title: 'Watermark', objective: 'x' },
        tasks: [{ id: 'task:a', title: 'A', lifecycle_status: 'running' }],
        graph_version: 4,
      },
      events: {
        rows: [{
          event_id: 'event:new-completion',
          transition: 'task_completed',
          task_id: 'task:a',
          graph_version: 5,
        }],
      },
    });
    expect(raced.snapshot.tasks[0].status).toBe('verified');
  });

  it('retains the event cursor while the event stream is degraded', () => {
    const previous = normalizePlanSnapshot({
      plan_id: 'plan:degraded',
      plan: { id: 'plan:degraded', title: 'Degraded', objective: 'do not skip events' },
      tasks: [{ id: 'task:a', title: 'A', lifecycle_status: 'running' }],
      graph_version: 80,
    });
    const degraded = normalizePlanPoll({
      snapshot: {
        plan_id: 'plan:degraded',
        plan: { id: 'plan:degraded', title: 'Degraded', objective: 'do not skip events' },
        tasks: [{ id: 'task:a', title: 'A', lifecycle_status: 'completed' }],
        graph_version: 100,
      },
      events: null,
      cursor: 80,
      degraded: { events: true },
    }, previous);
    expect(degraded.snapshot.tasks[0].status).toBe('verified');
    expect(degraded.snapshot.streamCursor).toBe(80);

    const recovered = normalizePlanPoll({
      snapshot: {
        plan_id: 'plan:degraded',
        plan: { id: 'plan:degraded', title: 'Degraded', objective: 'do not skip events' },
        tasks: [{ id: 'task:a', title: 'A', lifecycle_status: 'completed' }],
        graph_version: 100,
      },
      events: {
        rows: [{
          event_id: 'event:81',
          transition: 'turn_completed',
          task_id: 'task:a',
          graph_version: 81,
        }],
      },
      cursor: 100,
      degraded: { events: false },
    }, degraded.snapshot);
    expect(recovered.snapshot.streamCursor).toBe(100);
    expect(recovered.snapshot.events.map((event) => event.id)).toContain('event:81');
  });

  it('projects MCP task input and cancellation states without falling back to pending', () => {
    const inspected = normalizePlanSnapshot({
      plan_id: 'plan:task-states',
      plan: { id: 'plan:task-states', title: 'Task states', objective: 'project lifecycle' },
      tasks: [
        { id: 'task:input', title: 'Input', lifecycle_status: 'input_required', plan_status: 'pending' },
        { id: 'task:cancelled', title: 'Cancelled', lifecycle_status: 'cancelled', plan_status: 'pending' },
      ],
    });
    expect(inspected?.tasks.map((task) => task.status)).toEqual(['blocked', 'failed']);

    const inputEvent = applyPlanEvent(inspected!, {
      id: 'event:input',
      transition: 'thread_idle',
      nodeIds: ['task:cancelled'],
      actor: 'codex',
      graphVersion: 1,
      at: null,
      detail: { state: 'input_required' },
    });
    expect(inputEvent.tasks[1].status).toBe('blocked');
    const cancelledEvent = applyPlanEvent(inputEvent, {
      id: 'event:cancelled',
      transition: 'task_aborted',
      nodeIds: ['task:input'],
      actor: 'codex',
      graphVersion: 2,
      at: null,
      detail: { state: 'cancelled' },
    });
    expect(cancelledEvent.tasks[0].status).toBe('failed');
  });

  it('projects durable task escalation and folds live escalation receipts', () => {
    const inspected = normalizePlanSnapshot({
      plan_id: 'plan:escalation',
      plan: { id: 'plan:escalation', title: 'Escalation', objective: 'carry the claim' },
      tasks: [{
        id: 'task:escalated',
        title: 'Retry under a target head',
        lifecycle_status: 'working',
        plan_status: 'pending',
        assigned_head: 'mistral',
        escalation: {
          trigger: 'malformed_calls(2)',
          from_head: 'codex',
          target_head: 'mistral',
          originating_receipts: ['receipt:1', 'receipt:2'],
          occurred_at_ms: 42,
        },
      }],
    });
    expect(inspected?.tasks[0]).toMatchObject({
      status: 'escalated',
      assignedHead: 'mistral',
      escalation: {
        trigger: 'malformed_calls(2)',
        fromHead: 'codex',
        targetHead: 'mistral',
        originatingReceipts: ['receipt:1', 'receipt:2'],
        occurredAtMs: 42,
      },
    });
    expect(reportedEdgeProgress({ status: 'escalated', progressFraction: null })).toBe(0);

    const live = applyPlanEvent(inspected!, {
      id: 'event:escalated',
      transition: 'task_escalated',
      nodeIds: ['task:escalated'],
      actor: 'codex',
      graphVersion: 8,
      at: null,
      detail: {
        trigger: 'verify_failed',
        from_head: 'codex',
        target_head: 'mistral',
        originating_receipts: ['receipt:verify'],
      },
    });
    expect(live.tasks[0]).toMatchObject({
      status: 'escalated',
      claimHolder: null,
      assignedHead: 'mistral',
      escalation: {
        trigger: 'verify_failed',
        originatingReceipts: ['receipt:verify'],
      },
    });
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

    const staging = candidates.find((item) => item.value === 'staging' && item.kind === 'literal')!;
    const bound = applyParamBindings(snapshot!, candidates, { [staging.id]: 'production' });
    expect(bound.tasks[0].title).toContain('production');
    expect(bound.tasks[0].title).not.toContain('staging');
    const graph = planToProgrammableGraph(bound);
    const node = graph.nodes.find((row) => row.id === 'task:1') as { contract?: { name?: string } };
    expect(node?.contract?.name).toContain('production');
    expect(graph.authority).toBe('advisory');
    expect(graph.approval).toEqual({ mode: 'require_each_run', grant_ids: [] });
  });

  it('demotes side-effecting Plan affordances to advisory program metadata', () => {
    const snapshot = normalizePlanSnapshot({
      plan_id: 'plan:side-effect',
      plan: { id: 'plan:side-effect', title: 'Publish', objective: 'Publish safely' },
      tasks: [{
        id: 'task:publish',
        title: 'Publish release',
        status: 'verified',
        queued_affordances: [{
          ref: 'github:create_release',
          annotations: ['destructive'],
        }],
      }],
    });

    expect(sideEffectingAffordanceRefs(snapshot!)).toEqual(['github:create_release']);
    const graph = planToProgrammableGraph(snapshot!);
    const task = graph.nodes.find((node) => node.id === 'task:publish') as {
      affordance_id?: string;
      contract?: { capabilities?: Array<{ has_side_effects?: boolean }> };
    };
    expect(graph.authority).toBe('advisory');
    expect(graph.approval).toEqual({ mode: 'require_each_run', grant_ids: [] });
    expect(graph.metadata.execution_mode).toBe('advisory_proposal_only');
    expect(graph.metadata.source_side_effecting_affordance_refs).toEqual(['github:create_release']);
    expect(task.affordance_id).toBe('plan-task:task:publish');
    expect(task.contract?.capabilities?.[0]?.has_side_effects).toBe(false);
    const ports = graph.nodes.flatMap((node) => {
      const record = node as {
        inputs?: Array<{ shape_id: string }>;
        outputs?: Array<{ shape_id: string }>;
      };
      return [...(record.inputs ?? []), ...(record.outputs ?? [])].map((port) => port.shape_id);
    });
    expect(ports.every((shapeId) => shapeId === 'theorem:plan-task@1.0.0')).toBe(true);
  });
});
