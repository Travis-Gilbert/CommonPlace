import { describe, expect, it } from 'vitest';
import {
  CONSTELLATION_FULL_FIXTURE,
} from '@commonplace/block-view-contracts/search-stack-fixture';
import {
  CONSTELLATION_MEMORY_RADIUS,
  CONSTELLATION_NODE_RADIUS,
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

  it('settles every complete node extent inside the viewport', () => {
    const layout = run();
    for (const node of NODES) {
      const point = layout.get(node.id);
      if (!point) throw new Error(`missing layout point for ${node.id}`);
      const radius = node.kind === 'memory'
        ? CONSTELLATION_MEMORY_RADIUS
        : CONSTELLATION_NODE_RADIUS;
      expect(point.x - radius).toBeGreaterThanOrEqual(0);
      expect(point.x + radius).toBeLessThanOrEqual(880);
      expect(point.y - radius).toBeGreaterThanOrEqual(0);
      expect(point.y + radius).toBeLessThanOrEqual(520);
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
