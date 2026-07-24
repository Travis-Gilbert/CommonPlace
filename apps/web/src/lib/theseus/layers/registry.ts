// SOURCING: none — pure logic, no upstream component applies
/**
 * Thin re-export so existing web imports keep working. Prefer
 * `@commonplace/multiplex-layers` for new call sites.
 */
export {
  NATIVE_LAYER_DESCRIPTORS,
  createLayerSelection,
  edgeVisibleForLayers,
  fetchRegisteredLayers,
  layerIdForEdgeType,
  toggleLayer,
} from '@commonplace/multiplex-layers';

export type {
  LayerCardinality,
  LayerDescriptor,
  LayerDirection,
  LayerDurability,
  LayerSelectionState,
} from '@commonplace/multiplex-layers';
