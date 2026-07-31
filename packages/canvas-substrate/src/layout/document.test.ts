import { describe, expect, it } from 'vitest';
import {
  EMPTY_LAYOUT,
  frameMembership,
  fromLayoutWire,
  hiddenPorts,
  toLayoutWire,
  togglePortVisibility,
  withEdgeWaypoints,
  withNodeLayout,
  withoutFrame,
  type CanvasLayoutWire,
} from './document';

describe('frame membership is geometry', () => {
  const frames = {
    outer: { x: 0, y: 0, width: 400, height: 400 },
    inner: { x: 10, y: 10, width: 100, height: 100 },
  };

  it('gives a node to the smallest frame that fully contains it', () => {
    const membership = frameMembership(frames, [
      { id: 'a', x: 20, y: 20, width: 40, height: 40 },
      { id: 'b', x: 200, y: 200, width: 40, height: 40 },
    ]);
    expect(membership.a).toBe('inner');
    expect(membership.b).toBe('outer');
  });

  it('omits nodes inside no frame rather than mapping them to null', () => {
    const membership = frameMembership(frames, [
      { id: 'loose', x: 900, y: 900, width: 10, height: 10 },
    ]);
    expect(membership).toEqual({});
    expect('loose' in membership).toBe(false);
  });

  it('refuses partial overlap: a node half out of a frame is not a member', () => {
    const membership = frameMembership(frames, [
      { id: 'straddle', x: 90, y: 20, width: 40, height: 40 },
    ]);
    expect(membership.straddle).toBe('outer');
  });

  it('drops the cached frame id when the frame is deleted', () => {
    const document = withNodeLayout(EMPTY_LAYOUT, 'a', { x: 0, y: 0, frameId: 'inner' });
    const after = withoutFrame({ ...document, frames }, 'inner');
    expect(after.frames.inner).toBeUndefined();
    expect(after.nodes.a.frameId).toBeUndefined();
  });
});

describe('layout wire round-trip', () => {
  it('carries waypoints, port visibility, collapse and frames', () => {
    let document = withNodeLayout(EMPTY_LAYOUT, 'n1', {
      x: 12,
      y: 34,
      collapsed: true,
      advancedOpen: true,
    });
    document = togglePortVisibility(document, 'n1', 'seed');
    document = withEdgeWaypoints(document, 'e1', [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    document = { ...document, frames: { f1: { x: 0, y: 0, width: 10, height: 10, title: 'Step 1' } } };

    const restored = fromLayoutWire(toLayoutWire(document));
    expect(restored).toEqual(document);
    expect(hiddenPorts(restored, 'n1').has('seed')).toBe(true);
  });

  it('reads the pre-frame group_id spelling so old layouts keep their grouping', () => {
    const wire: CanvasLayoutWire = {
      nodes: { n1: { x: 0, y: 0 } },
      node_metadata: { n1: { collapsed: true, group_id: 'legacy' } },
    };
    const restored = fromLayoutWire(wire);
    expect(restored.nodes.n1.frameId).toBe('legacy');
    expect(restored.nodes.n1.collapsed).toBe(true);
  });

  it('survives a malformed wire instead of throwing', () => {
    expect(fromLayoutWire(undefined)).toEqual(EMPTY_LAYOUT);
    const restored = fromLayoutWire({
      nodes: { good: { x: 1, y: 2 }, bad: { x: 'nope' as never, y: 0 } },
      edge_metadata: { e: { waypoints: [{ x: 1 } as never] } },
      frames: { f: { x: 0, y: 0, width: 'wide' as never, height: 1 } },
    });
    expect(Object.keys(restored.nodes)).toEqual(['good']);
    expect(restored.edges).toEqual({});
    expect(restored.frames).toEqual({});
  });

  it('drops an edge entry entirely when its last waypoint is removed', () => {
    const withPoints = withEdgeWaypoints(EMPTY_LAYOUT, 'e1', [{ x: 1, y: 1 }]);
    expect(toLayoutWire(withPoints).edge_metadata).toBeDefined();
    const cleared = withEdgeWaypoints(withPoints, 'e1', []);
    expect(cleared.edges.e1).toBeUndefined();
    expect(toLayoutWire(cleared).edge_metadata).toBeUndefined();
  });
});
