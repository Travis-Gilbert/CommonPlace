// SOURCING: none. Barrel re-exports for the live model diagram surface.
// MC1 long-term surface is the OWOX fork (`ForkDiagramCanvas` +
// `@commonplace/model-canvas`). Pre-fork ObjectTypeCard / GhostCard /
// RelationEdge are quarantined — see ORPHAN.md.

export { ForkDiagramCanvas, type ForkDiagramCanvasProps } from './ForkDiagramCanvas';
export { RecordChip, type RecordChipProps } from './RecordChip';
export {
  GHOST_NODE_HEIGHT,
  layoutModelGraph,
  OBJECT_NODE_HEIGHT,
  OBJECT_NODE_WIDTH,
  type GhostCardData,
  type GhostFlowNode,
  type LayoutDirection,
  type LayoutPositions,
  type ModelFlowEdge,
  type ModelFlowNode,
  type ModelRelationEdgeData,
  type ObjectTypeCardData,
  type ObjectTypeFlowNode,
  type ObjectTypeRelationRow,
  type ObjectTypeScalarField,
} from './layout';
export { OBJECT_TINTS, tintForKey, type ObjectTint } from './tints';
