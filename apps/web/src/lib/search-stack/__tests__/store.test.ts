// @vitest-environment jsdom
/**
 * The search-stack store's four load-bearing behaviours (SPEC F2, F3, D4):
 * one request per aspect selection, the constellation as a breadcrumb, expand
 * touching only what was expanded, and lambda outliving the session.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_ASPECTS } from '@commonplace/block-view-contracts/search-stack';

const runScatter = vi.fn();
const runFind = vi.fn();
const runExpand = vi.fn();

vi.mock('../client', () => ({
  runScatter: (...args: unknown[]) => runScatter(...args),
  runFind: (...args: unknown[]) => runFind(...args),
  runExpand: (...args: unknown[]) => runExpand(...args),
  saveUrl: vi.fn(),
}));

const {
  createSearchStackStore,
  constellationStateOf,
  scatterOf,
  selectedFindOf,
  spliceExpansion,
  DEFAULT_LAMBDA,
} = await import('../store');
const { fixtureAspectFind, fixtureExpand, fixtureScatter, fixtureOrphanFind } = await import(
  '../fixtures'
);
const { clearBundle, getBundle } = await import('@/lib/carry/bundle-store');

let store: ReturnType<typeof createSearchStackStore>;
let key = 0;

beforeEach(() => {
  runScatter.mockReset();
  runFind.mockReset();
  runExpand.mockReset();
  window.localStorage.clear();
  key += 1;
  store = createSearchStackStore(`search-stack-test-${key}`);
  runScatter.mockImplementation(async (request: { query: string; lambda: number }) =>
    fixtureScatter(request.query, request.lambda),
  );
  runFind.mockImplementation(async (request: { query: string; lambda: number }) =>
    fixtureAspectFind(request.query, request.lambda),
  );
  runExpand.mockImplementation(async (request: { aspect: string; lambda: number }) =>
    fixtureExpand('membrane', request.aspect, request.lambda),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('aspect selection', () => {
  it('issues exactly one backend request and renders both scene and list from it', async () => {
    await store.getState().submit('membrane');
    expect(runScatter).toHaveBeenCalledTimes(1);

    await store.getState().selectAspect('aspect-budget');
    expect(runFind).toHaveBeenCalledTimes(1);

    const state = store.getState();
    // The list projection.
    const find = selectedFindOf(state);
    expect(find).toBeDefined();
    expect(find?.results.length).toBeGreaterThan(0);

    // The scene projection, built from that same response.
    const scene = constellationStateOf(state);
    expect(scene.kind).toBe('success');
    if (scene.kind !== 'success') throw new Error('expected success');
    expect(scene.payload.meta.subgraphRef).toBe(find?.retrievalRef);
    expect(scene.payload.nodes).toHaveLength(find?.results.length ?? 0);

    // Reading either projection again reaches no further than the store.
    constellationStateOf(store.getState());
    selectedFindOf(store.getState());
    expect(runFind).toHaveBeenCalledTimes(1);
  });

  it('reselecting a visited aspect issues no request at all', async () => {
    await store.getState().submit('membrane');
    await store.getState().selectAspect('aspect-budget');
    expect(runFind).toHaveBeenCalledTimes(1);

    store.getState().backToScatter();
    await store.getState().selectAspect('aspect-budget');
    expect(runFind).toHaveBeenCalledTimes(1);
  });
});

describe('the constellation as a breadcrumb', () => {
  it('preserves constellation state through node, list, page and back', async () => {
    await store.getState().submit('membrane');
    const scatterBefore = scatterOf(store.getState());
    expect(scatterBefore).toBeDefined();

    // node -> list
    await store.getState().selectAspect('aspect-budget');
    const findBefore = selectedFindOf(store.getState());
    expect(findBefore).toBeDefined();

    // list -> page
    const opened = vi.fn(async () => undefined);
    const node = constellationNodeAt(store, 0);
    await store.getState().openNode(node, { sessionId: null, open: opened });
    expect(opened).toHaveBeenCalledTimes(1);
    // The graph survived the navigation.
    expect(scatterOf(store.getState())).toBe(scatterBefore);
    expect(selectedFindOf(store.getState())).toBe(findBefore);

    // page -> back
    store.getState().backToScatter();
    expect(store.getState().layer).toBe('scatter');
    expect(scatterOf(store.getState())).toBe(scatterBefore);

    // and forward again, with nothing refetched anywhere along the way
    await store.getState().selectAspect('aspect-budget');
    expect(selectedFindOf(store.getState())).toBe(findBefore);
    expect(runScatter).toHaveBeenCalledTimes(1);
    expect(runFind).toHaveBeenCalledTimes(1);
  });
});

describe('expand', () => {
  it('replaces only the expanded region of the scene', async () => {
    await store.getState().submit('membrane');
    const before = scatterOf(store.getState());
    if (!before) throw new Error('expected a scatter');
    const untouched = before.aspects.filter((aspect) => aspect.id !== 'aspect-budget');

    await store.getState().expandAspect('aspect-budget');
    const after = scatterOf(store.getState());
    if (!after) throw new Error('expected a scatter');

    // Every aspect that was not expanded is the SAME object, so the layout pins
    // it and the region does not re-solve.
    for (const aspect of untouched) {
      expect(after.aspects).toContain(aspect);
    }
    // The expanded aspect is gone, replaced in place by its sub-aspects.
    expect(after.aspects.some((aspect) => aspect.id === 'aspect-budget')).toBe(false);
    expect(after.aspects.some((aspect) => aspect.id === 'aspect-budget-a')).toBe(true);
    expect(after.expandedFrom).toBe('aspect-budget');
  });

  it('trims the expansion, never the untouched region, at the aspect cap', () => {
    const base = fixtureScatter('membrane', 0.5);
    const wide = {
      ...base,
      aspects: Array.from({ length: MAX_ASPECTS }, (_, index) => ({
        ...base.aspects[0],
        id: `a${index}`,
      })),
    };
    const expansion = {
      ...fixtureExpand('membrane', 'a0', 0.5),
      aspects: Array.from({ length: 5 }, (_, index) => ({
        ...base.aspects[0],
        id: `a0-${index}`,
      })),
    };

    const next = spliceExpansion(wide, 'a0', expansion);
    expect(next.aspects.length).toBeLessThanOrEqual(MAX_ASPECTS);
    // All seven survivors of the original set are still there.
    for (let index = 1; index < MAX_ASPECTS; index += 1) {
      expect(next.aspects.some((aspect) => aspect.id === `a${index}`)).toBe(true);
    }
  });
});

describe('lambda', () => {
  it('persists across a simulated restart and changes the submitted request', async () => {
    const storageKey = `search-stack-lambda-${key}`;
    const first = createSearchStackStore(storageKey);
    expect(first.getState().lambda).toBe(DEFAULT_LAMBDA);

    first.getState().setLambda(0.15);
    await first.getState().submit('membrane');
    expect(runScatter).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'membrane', lambda: 0.15 }),
    );

    // Restart: a brand new store instance reading the same persisted key, with
    // no in-memory carry-over of results.
    const restarted = createSearchStackStore(storageKey);
    expect(restarted.getState().lambda).toBe(0.15);
    expect(scatterOf(restarted.getState())).toBeUndefined();

    await restarted.getState().submit('membrane');
    expect(runScatter).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'membrane', lambda: 0.15 }),
    );
  });

  it('clamps out-of-range values rather than sending them', () => {
    store.getState().setLambda(4);
    expect(store.getState().lambda).toBe(1);
    store.getState().setLambda(-2);
    expect(store.getState().lambda).toBe(0);
  });
});

describe('session start (D4)', () => {
  it('marks visited state accurately across three openings', async () => {
    await store.getState().submit('membrane');
    await store.getState().selectAspect('aspect-budget');
    const open = vi.fn(async () => undefined);

    for (let index = 0; index < 3; index += 1) {
      await store
        .getState()
        .openNode(constellationNodeAt(store, index), { sessionId: null, open });
    }

    const visited = store.getState().visited;
    expect(visited).toHaveLength(3);
    expect(new Set(visited).size).toBe(3);
    expect(store.getState().docked).toBe(true);

    // Reopening the first node does not double-count it.
    await store.getState().openNode(constellationNodeAt(store, 0), { sessionId: null, open });
    expect(store.getState().visited).toHaveLength(3);
  });

  it('records the constellation subgraph reference as the session bundle origin', async () => {
    const sessionId = `cobrowse-test-${key}`;
    await clearBundle(sessionId);

    await store.getState().submit('membrane');
    await store.getState().selectAspect('aspect-budget');
    const expected = selectedFindOf(store.getState())?.retrievalRef;
    expect(expected).toBeTruthy();

    await store
      .getState()
      .openNode(constellationNodeAt(store, 0), { sessionId, open: async () => undefined });

    const bundle = await getBundle(sessionId);
    expect(bundle?.origin).toBeDefined();
    expect(bundle?.origin?.kind).toBe('constellation');
    expect(bundle?.origin?.subgraphRef).toBe(expected);
    expect(bundle?.origin?.query).toBe('membrane');

    // A second opening continues the same session; the origin is not rewritten.
    await store
      .getState()
      .openNode(constellationNodeAt(store, 1), { sessionId, open: async () => undefined });
    const after = await getBundle(sessionId);
    expect(after?.origin?.nodeId).toBe(bundle?.origin?.nodeId);
  });

  it('reopens the map full size without disturbing the session', async () => {
    await store.getState().submit('membrane');
    await store.getState().selectAspect('aspect-budget');
    const scatterBefore = scatterOf(store.getState());
    await store
      .getState()
      .openNode(constellationNodeAt(store, 0), { sessionId: null, open: async () => undefined });
    expect(store.getState().docked).toBe(true);

    store.getState().reopenMap();
    expect(store.getState().docked).toBe(false);
    expect(store.getState().visited).toHaveLength(1);
    expect(scatterOf(store.getState())).toBe(scatterBefore);
  });
});

describe('zero graph connection', () => {
  it('projects every node as an orphan and does not throw', async () => {
    runFind.mockImplementation(async (request: { query: string }) =>
      fixtureOrphanFind(request.query),
    );
    await store.getState().submit('membrane');
    await store.getState().selectAspect('aspect-budget');

    const scene = constellationStateOf(store.getState());
    expect(scene.kind).toBe('success');
    if (scene.kind !== 'success') throw new Error('expected success');
    expect(scene.payload.nodes.length).toBeGreaterThan(0);
    expect(scene.payload.edges).toHaveLength(0);
    expect(scene.payload.nodes.every((node) => node.relation === 'orphan')).toBe(true);
  });
});

function constellationNodeAt(
  instance: ReturnType<typeof createSearchStackStore>,
  index: number,
) {
  const scene = constellationStateOf(instance.getState());
  if (scene.kind !== 'success') throw new Error(`expected a drawn scene, got ${scene.kind}`);
  const node = scene.payload.nodes[index];
  if (!node) throw new Error(`no node at ${index}`);
  return node;
}
