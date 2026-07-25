// SOURCING: none : pure logic, no upstream component applies
/**
 * Multiplex layer registry client helpers (SPEC-MULTIPLEX-LAYERS ML4).
 *
 * Shared by Console and the legacy web Mosaic explorer. Enumeration comes
 * from a same-origin layers route that should mirror
 * rustyred-thg-core::LayerRegistry::with_native_defaults (or a live Rust
 * export). The picker never hardcodes the inventory list.
 */

export type LayerDurability = 'durable' | 'derived' | 'ephemeral';
export type LayerCardinality = 'single' | 'multi' | 'ranked';
export type LayerDirection = 'directed' | 'symmetric' | 'positional';

export interface LayerDescriptor {
  id: string;
  durability: LayerDurability;
  cardinality: LayerCardinality;
  direction: LayerDirection;
  pinnable: boolean;
}

export interface LayerSelectionState {
  /** Active layer ids. Defaults to every registered layer. */
  layers: string[];
}

/** Mirror of LayerRegistry::with_native_defaults for route payloads and tests. */
export const NATIVE_LAYER_DESCRIPTORS: readonly LayerDescriptor[] = [
  {
    id: 'composition',
    durability: 'durable',
    cardinality: 'single',
    direction: 'directed',
    pinnable: true,
  },
  {
    id: 'derivation',
    durability: 'derived',
    cardinality: 'single',
    direction: 'directed',
    pinnable: true,
  },
  {
    id: 'temporal',
    durability: 'durable',
    cardinality: 'single',
    direction: 'directed',
    pinnable: true,
  },
  {
    id: 'authority',
    durability: 'durable',
    cardinality: 'single',
    direction: 'directed',
    pinnable: true,
  },
  {
    id: 'annotation',
    durability: 'durable',
    cardinality: 'multi',
    direction: 'directed',
    pinnable: true,
  },
  {
    id: 'presence',
    durability: 'ephemeral',
    cardinality: 'single',
    direction: 'symmetric',
    pinnable: false,
  },
  {
    id: 'semantic',
    durability: 'derived',
    cardinality: 'ranked',
    direction: 'symmetric',
    pinnable: false,
  },
] as const;

const NATIVE_IDS = new Set(NATIVE_LAYER_DESCRIPTORS.map((d) => d.id));

/** Round-trip helper: selection is (nodes) plus layers. */
export function createLayerSelection(
  registered: readonly LayerDescriptor[],
  active?: string[],
): LayerSelectionState {
  const all = registered.map((d) => d.id);
  if (active === undefined) {
    return { layers: all };
  }
  const allowed = new Set(all);
  return { layers: active.filter((id) => allowed.has(id)) };
}

export function toggleLayer(
  state: LayerSelectionState,
  layerId: string,
): LayerSelectionState {
  const set = new Set(state.layers);
  if (set.has(layerId)) {
    set.delete(layerId);
  } else {
    set.add(layerId);
  }
  return { layers: Array.from(set) };
}

/**
 * Fetch registered layers from a same-origin registry route.
 * Default path is `/api/layers` (Console). Legacy web also accepts
 * `/api/theseus/layers` as an alias.
 */
export async function fetchRegisteredLayers(
  fetcher: typeof fetch = fetch,
  path = '/api/layers',
): Promise<LayerDescriptor[]> {
  const res = await fetcher(path);
  if (!res.ok) {
    throw new Error(`layer registry unavailable: ${res.status}`);
  }
  const body = (await res.json()) as { layers?: LayerDescriptor[] };
  return Array.isArray(body.layers) ? body.layers : [];
}

/**
 * Filter edge rows by active layer set without touching the node selection.
 */
export function edgeVisibleForLayers(
  edgeLayer: string | null | undefined,
  activeLayers: ReadonlySet<string>,
): boolean {
  if (activeLayers.size === 0) return false;
  if (edgeLayer == null || edgeLayer === '') return false;
  return activeLayers.has(edgeLayer);
}

/**
 * Map a substrate edge_type / relation name onto a multiplex LayerId.
 *
 * Native layer ids pass through. A small provisional hint table covers
 * common Console relation names so toggles do something before a closed
 * product map lands. Unknown structural relations default to composition.
 */
export function layerIdForEdgeType(edgeType: string | null | undefined): string | null {
  if (edgeType == null || edgeType === '') return null;
  const key = edgeType.toLowerCase().replaceAll('-', '_');
  if (NATIVE_IDS.has(key)) return key;

  const hints: Record<string, string> = {
    tag: 'annotation',
    tags: 'annotation',
    shares_tag: 'annotation',
    annotated_by: 'annotation',
    memory: 'semantic',
    similar_to: 'semantic',
    near: 'semantic',
    links: 'composition',
    depends_on: 'composition',
    child_of: 'composition',
    part_of: 'composition',
    supports: 'derivation',
    supported_by: 'derivation',
    contradicts: 'derivation',
    conflicts_with: 'derivation',
    derived_from: 'derivation',
    why: 'derivation',
    granted_by: 'authority',
    delegates_to: 'authority',
    before: 'temporal',
    after: 'temporal',
    version_of: 'temporal',
    presence: 'presence',
  };
  if (hints[key]) return hints[key];
  return 'composition';
}
