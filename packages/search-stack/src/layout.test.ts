import { describe, expect, it } from 'vitest';
import {
  CONSTELLATION_FULL_FIXTURE,
} from '@commonplace/block-view-contracts/search-stack-fixture';
import {
  constellationSeed,
  layoutConstellation,
  type ConstellationLayoutNode,
} from './layout';

const NODES: ConstellationLayoutNode[] = [
  ...CONSTELLATION_FULL_FIXTURE.nodes.map((node) => ({
    id: node.id,
    kind: 'result' as const,
  })),
  ...CONSTELLATION_FULL_FIXTURE.memoryNodes.map((node) => ({
    id: node.id,
    kind: 'memory' as const,
  })),
];
const EDGES = CONSTELLATION_FULL_FIXTURE.edges.map((edge) => ({
  source: edge.source,
  target: edge.target,
}));

function run(
  query = CONSTELLATION_FULL_FIXTURE.meta.query,
  nodes = NODES,
  placed?: ReturnType<typeof layoutConstellation>,
) {
  return layoutConstellation({
    query,
    nodes,
    edges: EDGES,
    width: 880,
    height: 520,
    placed,
  });
}

describe('deterministic constellation layout', () => {
  it('returns identical coordinates for the same input', () => {
    expect([...run().entries()]).toEqual([...run().entries()]);
  });

  it('changes coordinates for a different query', () => {
    expect([...run('another question').entries()]).not.toEqual([
      ...run().entries(),
    ]);
  });

  it('seeds independent of node order', () => {
    expect(constellationSeed('q', ['a', 'b'])).toBe(
      constellationSeed('q', ['b', 'a']),
    );
  });

  it('settles every node inside the viewport', () => {
    for (const point of run().values()) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(880);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(520);
    }
  });

  it('pins placed nodes during streaming admission', () => {
    const placed = run('q', NODES.slice(0, 5));
    const admitted = run('q', NODES, placed);
    for (const [id, point] of placed) {
      expect(admitted.get(id)).toEqual(point);
    }
    expect(admitted.size).toBe(NODES.length);
  });
});
