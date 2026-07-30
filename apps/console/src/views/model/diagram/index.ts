// SOURCING: none. Barrel re-exports for the model diagram surface.

export { ForkDiagramCanvas, type ForkDiagramCanvasProps } from './ForkDiagramCanvas';
// The OWOX fork shell supersedes the removed MC1 hand-built canvas.
export { GhostCard } from './GhostCard';
export { ObjectTypeCard } from './ObjectTypeCard';
export { RecordChip, type RecordChipProps } from './RecordChip';
export { RelationEdge } from './RelationEdge';
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
