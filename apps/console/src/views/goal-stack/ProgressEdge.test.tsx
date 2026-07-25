import { renderToStaticMarkup } from 'react-dom/server';
import type { EdgeProps } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import type { GoalFlowEdge } from './plan-layout';

vi.mock('@xyflow/react', () => ({
  BaseEdge: ({ path }: { path: string }) => <path data-base-edge="true" d={path} />,
  getBezierPath: () => ['M 0 0 L 10 0', 0, 0],
}));

import { ProgressEdge } from './ProgressEdge';

describe('ProgressEdge', () => {
  it('keeps a zero-progress running edge fully clipped', () => {
    const props = {
      id: 'edge:zero',
      source: 'task:a',
      target: 'task:b',
      sourceX: 0,
      sourceY: 0,
      targetX: 10,
      targetY: 0,
      data: { progress: 0, state: 'running', onPath: true },
    } as unknown as EdgeProps<GoalFlowEdge>;

    const markup = renderToStaticMarkup(<ProgressEdge {...props} />);

    expect(markup).toContain('stroke-dasharray="0 1"');
    expect(markup).toContain('class="goal-edge-running"');
    expect(markup).toContain('mask="url(#');
  });
});
