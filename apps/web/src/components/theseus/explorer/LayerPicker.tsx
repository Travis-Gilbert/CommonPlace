// SOURCING: none — pure logic, no upstream component applies
'use client';

/**
 * Layer picker for the Mosaic selection surface (SPEC-MULTIPLEX-LAYERS ML4).
 * Enumerates from fetchRegisteredLayers(); toggling changes edge visibility
 * only (node selection unchanged, no refetch).
 */

import { useEffect, useState } from 'react';
import {
  createLayerSelection,
  fetchRegisteredLayers,
  toggleLayer,
  type LayerDescriptor,
  type LayerSelectionState,
} from '@/lib/theseus/layers/registry';

export interface LayerPickerProps {
  /** Called when the active layer set changes. Does not refetch nodes. */
  onLayerSetChange: (state: LayerSelectionState) => void;
  /** Optional initial active ids; default is every registered layer. */
  initialActive?: string[];
}

export function LayerPicker({ onLayerSetChange, initialActive }: LayerPickerProps) {
  const [registered, setRegistered] = useState<LayerDescriptor[]>([]);
  const [state, setState] = useState<LayerSelectionState>({ layers: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchRegisteredLayers(fetch, '/api/theseus/layers')
      .then((layers) => {
        if (cancelled) return;
        setRegistered(layers);
        const next = createLayerSelection(layers, initialActive);
        setState(next);
        onLayerSetChange(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
    // Mount once: registry enumeration is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <div role="alert">Layer registry unavailable</div>;
  }
  if (registered.length === 0) {
    return null;
  }

  const active = new Set(state.layers);

  return (
    <div role="group" aria-label="Multiplex layers">
      {registered.map((layer) => {
        const on = active.has(layer.id);
        return (
          <label key={layer.id} style={{ display: 'inline-flex', gap: '0.35rem', marginRight: '0.75rem' }}>
            <input
              type="checkbox"
              checked={on}
              onChange={() => {
                const next = toggleLayer(state, layer.id);
                setState(next);
                onLayerSetChange(next);
              }}
            />
            <span>{layer.id}</span>
          </label>
        );
      })}
    </div>
  );
}
