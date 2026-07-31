// SOURCING: none — barrel for the node-kind registry and the built-in kinds.

export {
  SUBSTRATE_LAYOUT_KEY,
  createNodeKindRegistry,
  useNodeTypes,
  type NodeKindRegistry,
  type SubstrateNodeData,
} from './registry';
export type {
  BadgeTone,
  EdgeFamily,
  EdgePaletteId,
  NodeBadge,
  NodeFlags,
  NodeKindBodyProps,
  NodeKindContext,
  NodeKindEntry,
  NodeKindId,
  NodeShellModel,
  NodeStatus,
  PortSection,
  PortSide,
  PortWidget,
  SubstratePort,
  WidgetRenderProps,
  WidgetRenderer,
} from './types';
export { GROUP_FRAME_KIND, groupFrameKind, type GroupFrameData } from './builtin/frame';
export {
  NOTE_MARKDOWN_KIND,
  createNoteMarkdownKind,
  type MarkdownRenderProps,
  type NoteMarkdownData,
} from './builtin/note';
export {
  JSON_CANVAS_FILE_KIND,
  JSON_CANVAS_GROUP_KIND,
  JSON_CANVAS_LINK_KIND,
  JSON_CANVAS_TEXT_KIND,
  jsonCanvasFileKind,
  jsonCanvasGroupKind,
  jsonCanvasKinds,
  jsonCanvasLinkKind,
  jsonCanvasTextKind,
} from './builtin/jsonCanvas';
