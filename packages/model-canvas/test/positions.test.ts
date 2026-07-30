import { describe, expect, it } from 'vitest';
import type { ModelGraph } from '@commonplace/okf';
import { graphWithChangedNodePositions } from '../src/state/positions';

const graph: ModelGraph = {
  storageId: null,
  nodes: [{
    key: 'orders',
    title: 'Orders',
    inputSource: 'TABLE',
    schema: [],
    position: { x: 16, y: 24 },
    status: 'created',
    owoxId: null,
  }],
  edges: [],
};

describe('graphWithChangedNodePositions', () => {
  it('ignores React Flow changes that leave layout coordinates unchanged', () => {
    expect(graphWithChangedNodePositions(graph, [{
      id: 'orders',
      position: { x: 16, y: 24 },
    }])).toBeNull();
  });

  it('returns a graph update only when a canvas node actually moves', () => {
    const updated = graphWithChangedNodePositions(graph, [{
      id: 'orders',
      position: { x: 80, y: 120 },
    }]);

    expect(updated?.nodes[0]?.position).toEqual({ x: 80, y: 120 });
    expect(updated?.edges).toBe(graph.edges);
  });
});
