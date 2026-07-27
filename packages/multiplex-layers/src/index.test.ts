import { describe, expect, it, vi } from 'vitest';
import {
  NATIVE_LAYER_DESCRIPTORS,
  createLayerSelection,
  edgeVisibleForLayers,
  fetchRegisteredLayers,
  layerIdForEdgeType,
  toggleLayer,
} from './index';

describe('multiplex-layers', () => {
  it('defaults to every registered layer', () => {
    const state = createLayerSelection(NATIVE_LAYER_DESCRIPTORS);
    expect(state.layers).toEqual(NATIVE_LAYER_DESCRIPTORS.map((d) => d.id));
  });

  it('preserves an explicitly empty layer selection', () => {
    const state = createLayerSelection(NATIVE_LAYER_DESCRIPTORS, []);
    expect(state.layers).toEqual([]);
  });

  it('round-trips toggle without refetch semantics', () => {
    const state = createLayerSelection(NATIVE_LAYER_DESCRIPTORS);
    const off = toggleLayer(state, 'derivation');
    expect(off.layers).not.toContain('derivation');
    expect(off.layers).toContain('composition');
  });

  it('filters edges by active layer set', () => {
    const active = new Set(['composition']);
    expect(edgeVisibleForLayers('composition', active)).toBe(true);
    expect(edgeVisibleForLayers('derivation', active)).toBe(false);
  });

  it('maps relation hints onto native layers', () => {
    expect(layerIdForEdgeType('supports')).toBe('derivation');
    expect(layerIdForEdgeType('shares_tag')).toBe('annotation');
    expect(layerIdForEdgeType('memory')).toBe('semantic');
    expect(layerIdForEdgeType('composition')).toBe('composition');
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
    const layers = await fetchRegisteredLayers(fetcher as unknown as typeof fetch, '/api/layers');
    expect(layers.map((l) => l.id)).toContain('eighth');
    expect(fetcher).toHaveBeenCalledWith('/api/layers');
  });
});
