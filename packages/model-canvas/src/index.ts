// SOURCING: OWOX/models hard fork (Apache-2.0) -- packages/okf + MartNode/RelEdge/diff

export { ModelCanvasShell, type ModelCanvasShellProps } from './ModelCanvasShell';
export { MartNode, type MartNodeData } from './components/canvas/MartNode';
export { RelEdge, type RelEdgeData } from './components/canvas/RelEdge';
export { DiffDialog } from './components/DiffDialog';
export { buildRfEdges, isEdgeReconnectable } from './components/canvas/edges';
export { createModelStore, type ModelStore } from './state/model';
export { diffGraphs, type GraphDiff, type FieldChange } from './lib/diff';
export type {
  ModelGraph,
  ModelNode,
  ModelEdge,
  SchemaField,
  Cardinality,
  JoinKey,
} from '@commonplace/okf';
