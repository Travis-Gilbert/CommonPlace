// SOURCING: none — pure logic, no upstream component applies.

export type {
  CanvasColor,
  CanvasColorPreset,
  CanvasConnection,
  CanvasEdge,
  CanvasGroup,
  CanvasNode,
  CanvasObjectProjection,
  CanvasPlacement,
  EdgeEnd,
  FileCanvasNode,
  GraphCanvas,
  GraphCanvasMeta,
  GroupBackgroundStyle,
  GroupCanvasNode,
  JSONCanvas,
  LinkCanvasNode,
  NodeSide,
  TextCanvasNode,
} from './types';
export { EMPTY_CANVAS } from './types';

export { CanvasParseError, parseCanvasText, parseCanvasValue, validateJsonCanvas } from './parse';
export { serializeCanvas } from './serialize';
export {
  exportCanvasColor,
  isCanvasPreset,
  PRESET_TO_IJ_TOKEN,
  resolveCanvasColor,
} from './colors';
export {
  CANVAS_CARD_TYPE,
  CANVAS_CONNECT_EDGE,
  CANVAS_CONNECTION_TYPE,
  CANVAS_GROUP_TYPE,
  CANVAS_MEMBER_EDGE,
  CANVAS_TYPE,
  CANVAS_TYPES,
  emptyGraphCanvas,
  findObject,
  placementKey,
  removeConnection,
  removePlacement,
  upsertConnection,
  upsertGroup,
  upsertObject,
  upsertPlacement,
} from './model';
export { fromJsonCanvas, toJsonCanvas } from './interchange';
export type { FromJsonCanvasOptions } from './interchange';
export {
  applyJsonCanvasAsActions,
  graphCanvasToActions,
} from './apply';
export type { ApplyJsonCanvasOptions, CanvasObjectAction } from './apply';
