import { describe, expect, it } from 'vitest';
import {
  constellationSeed,
  layoutConstellation,
  type ConstellationLayoutEdge,
  type ConstellationLayoutNode,
  type ConstellationPoint,
} from '@/lib/constellation-layout';
import {
  CONSTELLATION_FULL_FIXTURE,
} from '@commonplace/block-view-contracts/search-stack-fixture';

const NODES: ConstellationLayoutNode[] = [
  ...CONSTELLATION_FULL_FIXTURE.nodes.map((node) => ({ id: node.id, kind: 'result' as const })),
  ...CONSTELLATION_FULL_FIXTURE.memoryNodes.map((node) => ({ id: node.id, kind: 'memory' as const })),
];
const EDGES: ConstellationLayoutEdge[] = CONSTELLATION_FULL_FIXTURE.edges.map((edge) => ({
  source: edge.source,
  target: edge.target,
}));
const QUERY = CONSTELLATION_FULL_FIXTURE.meta.query;
const BOX = { width: 880, height: 520 };

function run(query: string, nodes = NODES, placed?: Map<string, ConstellationPoint>) {
  return layoutConstellation({ query, nodes, edges: EDGES, ...BOX, placed });
}

describe('layoutConstellation determinism', () => {
  it('produces identical coordinates for the same query and node set', () => {
    const first = run(QUERY);
    const second = run(QUERY);
    expect([...second.entries()]).toEqual([...first.entries()]);
  });

  it('produces different coordinates for a different query', () => {
    const first = run(QUERY);
    const other = run('a completely different question');
    const moved = [...first.entries()].filter(([id, point]) => {
      const next = other.get(id);
      return !next || next.x !== point.x || next.y !== point.y;
    });
    expect(moved.length).toBeGreaterThan(0);
  });

  it('seeds from the query text and the node id set', () => {
    expect(constellationSeed('a', ['n1', 'n2'])).toBe(constellationSeed('a', ['n2', 'n1']));
    expect(constellationSeed('a', ['n1'])).not.toBe(constellationSeed('b', ['n1']));
  });

  it('settles every node inside the drawing box', () => {
    const layout = run(QUERY);
    expect(layout.size).toBe(NODES.length);
    for (const point of layout.values()) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(BOX.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(BOX.height);
    }
  });
});

describe('layoutConstellation streaming admission', () => {
  it('does not move already placed nodes when new nodes are admitted', () => {
    const firstWave = NODES.slice(0, 5);
    const placed = run(QUERY, firstWave);

    const secondWave = NODES;
    const next = run(QUERY, secondWave, new Map(placed));

    for (const [id, point] of placed.entries()) {
      expect(next.get(id)).toEqual(point);
    }
    expect(next.size).toBe(NODES.length);
  });

  it('places the newcomers somewhere real', () => {
    const firstWave = NODES.slice(0, 5);
    const placed = run(QUERY, firstWave);
    const next = run(QUERY, NODES, new Map(placed));

    for (const node of NODES.slice(5)) {
      const point = next.get(node.id);
      expect(point).toBeDefined();
      expect(Number.isFinite(point?.x)).toBe(true);
      expect(Number.isFinite(point?.y)).toBe(true);
    }
  });

  it('stays deterministic across repeated streaming runs', () => {
    const placed = run(QUERY, NODES.slice(0, 5));
    const a = run(QUERY, NODES, new Map(placed));
    const b = run(QUERY, NODES, new Map(placed));
    expect([...b.entries()]).toEqual([...a.entries()]);
  });
});
