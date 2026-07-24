'use client';

// SOURCING: IndexRulesView predicate chips (h-ij-row, rounded-ij-arc,
// border-ij-control-border, data-active -> bg-ij-selection) and GoalStack
// aria-pressed toolbar controls. Not native checkboxes.

/**
 * Console layer picker (SPEC-MULTIPLEX-LAYERS ML4). Enumerates from
 * /api/layers; toggling changes edge visibility only (no node refetch).
 */

import { useEffect, useState, type ReactNode } from 'react';
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

/**
 * Visual cue for layers the substrate refuses to pin (ML3).
 * Keep tokens on the register: --ij-*, font-ij-mono, rounded-ij-arc-underline.
 * Avoid inventing a second status language next to StatusBar / ViewState.
 */
function markNonPinnableChip(_layerId: string): ReactNode {
  // TODO: return a small register-native mark (for example a muted
  // "ephemeral" underline badge, or nothing if title= is enough).
  return null;
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
      <div
        className="flex h-ij-control shrink-0 items-center border-b border-ij-seam bg-ij-chrome px-3 text-ij-ink-info"
        role="alert"
        data-layer-picker-error
      >
        Layer registry unavailable
      </div>
    );
  }
  if (registered.length === 0) return null;

  const active = new Set(state.layers);

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1 border-b border-ij-seam bg-ij-chrome px-2 py-1"
      role="group"
      aria-label="Multiplex layers"
      data-layer-picker
    >
      <span className="mr-1 font-ij-mono text-ij-ink-info">Layers</span>
      {registered.map((layer) => {
        const on = active.has(layer.id);
        return (
          <button
            key={layer.id}
            type="button"
            aria-pressed={on}
            data-layer-id={layer.id}
            data-layer-active={on ? 'true' : undefined}
            title={
              layer.pinnable
                ? `${layer.id} (${layer.durability}, ${layer.cardinality})`
                : `${layer.id} (${layer.durability}, not pinnable)`
            }
            onClick={() => {
              const next = toggleLayer(state, layer.id);
              setState(next);
              onLayerSetChange(next);
            }}
            className="h-ij-row rounded-ij-arc border border-ij-control-border px-2 text-ij-ink-info hover:bg-ij-hover-surface data-[layer-active=true]:bg-ij-selection data-[layer-active=true]:text-ij-ink focus:outline-2 focus:outline-ij-accent"
          >
            {layer.id}
            {/* TODO(you): non-pinnable layers (presence, semantic) need a
                register-native cue. Implement markNonPinnableChip below so the
                chip still reads as Int UI, not a free-form glyph. */}
            {!layer.pinnable ? markNonPinnableChip(layer.id) : null}
          </button>
        );
      })}
    </div>
  );
}
