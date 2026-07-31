// SOURCING: none — barrel for the substrate edge language.

export {
  EDGE_DASH,
  EDGE_DASH_CYCLE,
  EDGE_GEOMETRY,
  EDGE_LINECAP,
  EDGE_STROKE,
  RUNNING_EDGE_ANIMATION_CAP,
  edgeAttention,
  edgeStroke,
  edgeStrokeStyle,
  familyStroke,
  marchingEdgeIds,
  type EdgeAttention,
  type EdgeStrokeStyle,
} from './law';
export { SubstrateEdge, type SubstrateEdgeData } from './SubstrateEdge';
export { ConnectionSatisfaction, type ConnectionSatisfactionProps } from './ConnectionSatisfaction';
export { makeConnectionLine } from './SubstrateConnectionLine';
export {
  insertWaypoint,
  insertionIndex,
  moveWaypoint,
  removeWaypoint,
  waypointLabelAnchor,
  waypointPath,
  type Point,
} from './waypoints';
