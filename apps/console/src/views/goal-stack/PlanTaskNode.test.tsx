import { renderToStaticMarkup } from 'react-dom/server';
import type { NodeProps } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import { normalizePlanSnapshot } from '@commonplace/theorem-acp/plan-state';
import type { GoalFlowNode } from './plan-layout';

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ isOver: false, setNodeRef: () => undefined }),
}));

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}));

vi.mock('@/components/mark/PresenceMark', () => ({
  PresenceMark: () => <span data-presence-mark="true" />,
}));

import { PlanTaskNode } from './PlanTaskNode';

describe('PlanTaskNode', () => {
  it('renders the durable escalation target on the canvas node', () => {
    const snapshot = normalizePlanSnapshot({
      plan_id: 'plan:escalation-node',
      plan: { id: 'plan:escalation-node', title: 'Escalation', objective: 'show the target' },
      tasks: [{
        id: 'task:escalation-node',
        title: 'Escalated task',
        lifecycle_status: 'escalated',
        assigned_head: 'mistral',
        escalation: {
          trigger: 'malformed_calls(2)',
          from_head: 'codex',
          target_head: 'mistral',
          originating_receipts: ['receipt:1', 'receipt:2'],
        },
      }],
    });
    const task = snapshot?.tasks[0];
    if (!task) throw new Error('fixture task missing');
    const props = {
      id: task.id,
      selected: false,
      data: { task, onPath: true, pathRole: 'idle' },
    } as unknown as NodeProps<GoalFlowNode>;

    const markup = renderToStaticMarkup(<PlanTaskNode {...props} />);

    expect(markup).toContain('data-plan-status="escalated"');
    expect(markup).toContain('data-task-escalation="mistral"');
    expect(markup).toContain('escalated to mistral');
  });

  it('renders determined and undetermined data-type badges, and none when absent', () => {
    const determined = normalizePlanSnapshot({
      plan_id: 'plan:dtype',
      plan: { id: 'plan:dtype', title: 'Dtype', objective: 'badge' },
      tasks: [{
        id: 'task:determined',
        title: 'Determined',
        data_type_badge: { kind: 'determined', column_count: 3, types: ['text', 'integer', 'boolean'] },
      }],
    })?.tasks[0];
    const undetermined = normalizePlanSnapshot({
      plan_id: 'plan:dtype',
      plan: { id: 'plan:dtype', title: 'Dtype', objective: 'badge' },
      tasks: [{
        id: 'task:undetermined',
        title: 'Undetermined',
        data_type_badge: { kind: 'undetermined' },
      }],
    })?.tasks[0];
    const absent = normalizePlanSnapshot({
      plan_id: 'plan:dtype',
      plan: { id: 'plan:dtype', title: 'Dtype', objective: 'badge' },
      tasks: [{ id: 'task:none', title: 'None' }],
    })?.tasks[0];
    if (!determined || !undetermined || !absent) throw new Error('fixture tasks missing');

    const determinedMarkup = renderToStaticMarkup(
      <PlanTaskNode
        {...({
          id: determined.id,
          selected: false,
          data: { task: determined, onPath: true, pathRole: 'idle' },
        } as unknown as NodeProps<GoalFlowNode>)}
      />,
    );
    const undeterminedMarkup = renderToStaticMarkup(
      <PlanTaskNode
        {...({
          id: undetermined.id,
          selected: false,
          data: { task: undetermined, onPath: true, pathRole: 'idle' },
        } as unknown as NodeProps<GoalFlowNode>)}
      />,
    );
    const absentMarkup = renderToStaticMarkup(
      <PlanTaskNode
        {...({
          id: absent.id,
          selected: false,
          data: { task: absent, onPath: true, pathRole: 'idle' },
        } as unknown as NodeProps<GoalFlowNode>)}
      />,
    );

    expect(determinedMarkup).toContain('data-data-type-badge="determined"');
    expect(determinedMarkup).toContain('text · integer · boolean');
    expect(undeterminedMarkup).toContain('data-data-type-badge="undetermined"');
    expect(undeterminedMarkup).toContain('schema undetermined');
    expect(absentMarkup).not.toContain('data-data-type-badge');
  });
});
