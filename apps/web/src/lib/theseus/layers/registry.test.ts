// SOURCING: none. Pure logic, no upstream component applies
import { describe, expect, it, vi } from 'vitest';
import {
  NATIVE_LAYER_DESCRIPTORS,
  createLayerSelection,
  edgeVisibleForLayers,
  fetchRegisteredLayers,
  toggleLayer,
} from '@commonplace/multiplex-layers';

describe('layer selection (ML4) via shared package', () => {
  it('defaults to every registered layer', () => {
    const state = createLayerSelection(NATIVE_LAYER_DESCRIPTORS);
    expect(state.layers).toHaveLength(7);
  });

  it('round-trips an explicit layer set', () => {
    const state = createLayerSelection(NATIVE_LAYER_DESCRIPTORS, ['composition', 'presence']);
    expect(state.layers).toEqual(['composition', 'presence']);
    const toggled = toggleLayer(state, 'derivation');
    expect(toggled.layers.sort()).toEqual(['composition', 'derivation', 'presence']);
  });

  it('preserves an explicitly empty layer selection', () => {
    expect(createLayerSelection(NATIVE_LAYER_DESCRIPTORS, []).layers).toEqual([]);
  });

  it('hides edges when their layer is toggled off', () => {
    const active = new Set(['composition', 'authority']);
    expect(edgeVisibleForLayers('composition', active)).toBe(true);
    expect(edgeVisibleForLayers('derivation', active)).toBe(false);
  });

  it('enumerates from the registry fetcher', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        layers: [
          ...NATIVE_LAYER_DESCRIPTORS,
          {
            id: 'eighth',
            durability: 'durable',
            cardinality: 'single',
            direction: 'directed',
            pinnable: true,
          },
        ],
      }),
    );
    const layers = await fetchRegisteredLayers(
      fetcher as unknown as typeof fetch,
      '/api/theseus/layers',
    );
    expect(layers.map((l) => l.id)).toContain('eighth');
  });
});

describe('single coordinator gate (ML5)', () => {
  it('does not construct a second Mosaic coordinator module path', async () => {
    const a = await import('@/lib/theseus/mosaic/coordinator');
    const b = await import('@/lib/theseus/mosaic/coordinator');
    expect(a.initMosaicCoordinator).toBe(b.initMosaicCoordinator);
    expect(a.timeRangeSelection).toBe(b.timeRangeSelection);
    expect(a.edgeTypeSelection).toBe(b.edgeTypeSelection);
  });
});
