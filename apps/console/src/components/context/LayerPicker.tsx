// SOURCING: none. Pure logic, no upstream component applies
'use client';

/**
 * Console layer picker (SPEC-MULTIPLEX-LAYERS ML4). Enumerates from
 * /api/layers; toggling changes edge visibility only (no node refetch).
 */

import { useEffect, useState } from 'react';
import {
  createLayerSelection,
  fetchRegisteredLayers,
  toggleLayer,
  type LayerDescriptor,
  type LayerSelectionState,
} from '@commonplace/multiplex-layers';

export interface LayerPickerProps {
  onLayerSetChange: (state: LayerSelectionState) => void;
  initialActive?: string[];
}

export function LayerPicker({ onLayerSetChange, initialActive }: LayerPickerProps) {
  const [registered, setRegistered] = useState<LayerDescriptor[]>([]);
  const [state, setState] = useState<LayerSelectionState>({ layers: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchRegisteredLayers(fetch, '/api/layers')
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
    return (
      <div className="px-2 py-1 text-ij-ink-info" role="alert">
        Layer registry unavailable
      </div>
    );
  }
  if (registered.length === 0) return null;

  const active = new Set(state.layers);

  return (
    <div
      className="flex flex-wrap gap-2 border-b border-ij-seam px-2 py-1"
      role="group"
      aria-label="Multiplex layers"
    >
      {registered.map((layer) => {
        const on = active.has(layer.id);
        return (
          <label
            key={layer.id}
            className="inline-flex cursor-pointer items-center gap-1 font-ij-ui text-ij-ink"
          >
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
