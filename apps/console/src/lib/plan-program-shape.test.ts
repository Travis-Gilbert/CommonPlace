import { describe, expect, it } from 'vitest';
import {
  parseShapeId,
  PLAN_TASK_SHAPE_ID,
  planToProgrammableGraph,
} from '@commonplace/theorem-acp/plan-program';
import { normalizePlanSnapshot } from '@commonplace/theorem-acp/plan-state';

describe('plan-program ShapeId emission', () => {
  it('parses the registered plan-task reference and rejects the legacy opaque string', () => {
    expect(parseShapeId(PLAN_TASK_SHAPE_ID)).toEqual({
      namespace: 'theorem',
      name: 'plan-task',
      version: { major: 1, minor: 0, patch: 0 },
    });
    expect(() => parseShapeId('theorem.plan-task.v1')).toThrow(/shape_reference/);
  });

  it('emits parseable shape ids on every promoted port', () => {
    const snapshot = normalizePlanSnapshot({
      plan_id: 'plan:forme',
      plan: { id: 'plan:forme', title: 'Ship forme types', objective: 'Type the programmable graph' },
      tasks: [{
        id: 'task:index',
        alias: 'index',
        title: 'Index',
        description: 'Index shapes',
        status: 'verified',
      }],
    });
    const program = planToProgrammableGraph(snapshot!);
    const shapeIds = program.nodes.flatMap((node) => {
      const record = node as {
        inputs?: Array<{ shape_id: string }>;
        outputs?: Array<{ shape_id: string }>;
      };
      return [...(record.inputs ?? []), ...(record.outputs ?? [])].map((port) => port.shape_id);
    });
    expect(shapeIds.length).toBeGreaterThan(0);
    for (const shapeId of shapeIds) {
      expect(shapeId).toBe(PLAN_TASK_SHAPE_ID);
      expect(parseShapeId(shapeId).name).toBe('plan-task');
    }
  });
});
