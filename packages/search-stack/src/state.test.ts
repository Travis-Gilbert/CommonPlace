import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_ASPECTS,
} from './contracts';
import type { SearchStackClient } from './client';
import {
  DEFAULT_LAMBDA,
  clampLambda,
  constellationStateOf,
  createSearchStackController,
  scatterOf,
  selectedFindOf,
  spliceExpansion,
  type SearchPreferenceStore,
} from './state';
import { expansion, find, scatter } from './__tests__/fixtures';

let client: SearchStackClient;

beforeEach(() => {
  client = {
    find: vi.fn(async (request) => find(request.query, request.lambda)),
    scatter: vi.fn(async (request) =>
      scatter(request.query, request.lambda)
    ),
    expand: vi.fn(async (request) =>
      expansion(request.aspectId, request.lambda)
    ),
    saveUrl: vi.fn(),
  };
});

describe('search stack controller', () => {
  it('submits one scatter request', async () => {
    const store = createSearchStackController({ client });
    await store.submit('membrane');
    expect(client.scatter).toHaveBeenCalledTimes(1);
    expect(scatterOf(store.getSnapshot())?.query).toBe('membrane');
  });

  it('feeds scene and list from one aspect request', async () => {
    const store = createSearchStackController({ client });
    await store.submit('membrane');
    await store.selectAspect('aspect-budget');
    expect(client.find).toHaveBeenCalledTimes(1);
    expect(selectedFindOf(store.getSnapshot())).toBeDefined();
    expect(constellationStateOf(store.getSnapshot()).kind).toBe('success');
    store.backToScatter();
    await store.selectAspect('aspect-budget');
    expect(client.find).toHaveBeenCalledTimes(1);
  });

  it('replaces only the expanded aspect', async () => {
    const store = createSearchStackController({ client });
    await store.submit('membrane');
    const before = scatterOf(store.getSnapshot());
    if (!before) throw new Error('expected scatter');
    const untouched = before.aspects.slice(1);
    await store.expandAspect('aspect-budget');
    const after = scatterOf(store.getSnapshot());
    if (!after) throw new Error('expected expanded scatter');
    expect(after.aspects.some((aspect) => aspect.id === 'aspect-budget')).toBe(
      false,
    );
    for (const aspect of untouched) {
      expect(after.aspects).toContain(aspect);
    }
  });

  it('persists only the lambda preference through an injected store', async () => {
    const values = new Map<string, string>();
    const preferences: SearchPreferenceStore = {
      read: (key) => values.get(key) ?? null,
      write: (key, value) => values.set(key, value),
    };
    const first = createSearchStackController({ client, preferences });
    expect(first.getSnapshot().lambda).toBe(DEFAULT_LAMBDA);
    first.setLambda(0.15);
    await first.submit('membrane');
    const restarted = createSearchStackController({ client, preferences });
    expect(restarted.getSnapshot().lambda).toBe(0.15);
    expect(scatterOf(restarted.getSnapshot())).toBeUndefined();
  });

  it('marks visited nodes once and docks the map', async () => {
    const store = createSearchStackController({ client });
    await store.submit('membrane');
    await store.selectAspect('aspect-budget');
    const scene = constellationStateOf(store.getSnapshot());
    if (scene.kind !== 'success') throw new Error('expected scene');
    const node = scene.payload.nodes[0];
    const open = vi.fn(async () => undefined);
    await store.openNode(node, { sessionId: null, open });
    await store.openNode(node, { sessionId: null, open });
    expect(store.getSnapshot().visited).toEqual([node.id]);
    expect(store.getSnapshot().docked).toBe(true);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('records the current subgraph as the session origin', async () => {
    const store = createSearchStackController({ client });
    await store.submit('membrane');
    await store.selectAspect('aspect-budget');
    const scene = constellationStateOf(store.getSnapshot());
    if (scene.kind !== 'success') throw new Error('expected scene');
    const recordOrigin = vi.fn(async () => undefined);
    await store.openNode(scene.payload.nodes[0], {
      sessionId: 'session-1',
      open: async () => undefined,
      recordOrigin,
    });
    expect(recordOrigin).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        kind: 'constellation',
        subgraphRef: 'find-1',
        query: 'membrane',
      }),
    );
  });

  it('opens the page but surfaces a refused origin write', async () => {
    const store = createSearchStackController({ client });
    await store.submit('membrane');
    await store.selectAspect('aspect-budget');
    const scene = constellationStateOf(store.getSnapshot());
    if (scene.kind !== 'success') throw new Error('expected scene');
    const open = vi.fn(async () => undefined);
    await store.openNode(scene.payload.nodes[0], {
      sessionId: 'session-1',
      open,
      recordOrigin: async () => {
        throw new Error('identity refused');
      },
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().error).toContain('without a durable search origin');
    expect(store.getSnapshot().error).toContain('identity refused');
  });

  it('reopens without clearing the session state', async () => {
    const store = createSearchStackController({ client });
    await store.submit('membrane');
    await store.selectAspect('aspect-budget');
    const scene = constellationStateOf(store.getSnapshot());
    if (scene.kind !== 'success') throw new Error('expected scene');
    await store.openNode(scene.payload.nodes[0], {
      sessionId: null,
      open: async () => undefined,
    });
    store.reopenMap();
    expect(store.getSnapshot().docked).toBe(false);
    expect(store.getSnapshot().visited).toHaveLength(1);
    expect(selectedFindOf(store.getSnapshot())).toBeDefined();
  });
});

describe('pure state helpers', () => {
  it('clamps lambda into the wire range', () => {
    expect(clampLambda(2)).toBe(1);
    expect(clampLambda(-1)).toBe(0);
    expect(clampLambda(Number.NaN)).toBe(DEFAULT_LAMBDA);
  });

  it('trims expansion before evicting untouched aspects', () => {
    const base = {
      ...scatter(),
      aspects: Array.from({ length: MAX_ASPECTS }, (_, index) => ({
        ...scatter().aspects[0],
        id: `a${index}`,
      })),
    };
    const expanded = {
      ...expansion('a0'),
      aspects: Array.from({ length: 5 }, (_, index) => ({
        ...scatter().aspects[0],
        id: `a0-${index}`,
      })),
    };
    const next = spliceExpansion(base, 'a0', expanded);
    expect(next.aspects).toHaveLength(MAX_ASPECTS);
    for (let index = 1; index < MAX_ASPECTS; index += 1) {
      expect(next.aspects.some((aspect) => aspect.id === `a${index}`)).toBe(
        true,
      );
    }
  });

  it('keeps a zero-edge orphan constellation valid', () => {
    const response = find();
    const orphan = {
      ...response,
      results: response.results.map((result) => ({
        ...result,
        relation: 'ORPHAN' as const,
        edges: [],
      })),
    };
    const store = createSearchStackController({
      client: {
        ...client,
        find: async () => orphan,
      },
    });
    return store.submit('membrane')
      .then(() => store.selectAspect('aspect-budget'))
      .then(() => {
        const scene = constellationStateOf(store.getSnapshot());
        expect(scene.kind).toBe('success');
        if (scene.kind === 'success') {
          expect(scene.payload.edges).toHaveLength(0);
          expect(
            scene.payload.nodes.every((node) => node.relation === 'ORPHAN'),
          ).toBe(true);
        }
      });
  });
});
