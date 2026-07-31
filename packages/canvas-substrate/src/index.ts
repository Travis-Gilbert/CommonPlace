// SOURCING: none — public surface of the canvas substrate (issue 144 A).
//
// One shell, a kind registry, one edge language, and the layout document that
// holds arrangement without ever touching content identity. The two product
// canvases -- the model ERD and the program graph -- register their own kinds
// from outside this package, which is the property that keeps the shell honest.

export * from './kinds';
export * from './edges';
export { NodeShell, type NodeShellProps } from './shell/NodeShell';
export { PortRow, type PortRowProps } from './shell/PortRow';
export { shortNodeBadge } from './shell/shortNodeBadge';
export {
  EMPTY_LAYOUT,
  edgeWaypoints,
  frameMembers,
  frameMembership,
  fromLayoutWire,
  hiddenPorts,
  nodeLayout,
  toLayoutWire,
  togglePortVisibility,
  withEdgeWaypoints,
  withFrame,
  withNodeLayout,
  withoutFrame,
  type CanvasLayoutDocument,
  type CanvasLayoutWire,
  type EdgeLayout,
  type FrameLayout,
  type NodeBox,
  type NodeLayout,
} from './layout/document';
