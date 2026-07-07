/**
 * Pure JSON Canvas <-> React Flow conversion + board-editing helpers.
 *
 * Kept dependency-free of React/@xyflow so it can be unit tested directly
 * (matching the tool-result-readers.ts precedent from WS3: this repo has no
 * jsdom/RTL, so anything that can be pure logic is extracted and tested
 * with plain vitest instead of a rendered component).
 */
import type { CanvasColor, CanvasEdge, CanvasNode, EdgeEnd, JSONCanvas, NodeSide } from './json-canvas';

/**
 * Default board id used until WS6 mints per-Item board ids for network
 * co-presence. Duplicated (not imported) from board-store.ts on purpose:
 * that module pulls in node:fs/promises and must never end up in a client
 * bundle, while this constant is needed by the client-side WorkBoard too.
 */
export const DEFAULT_BOARD_ID = 'default';

export interface BoardNodeData extends Record<string, unknown> {
  readonly node: CanvasNode;
}

export interface BoardFlowNode {
  readonly id: string;
  readonly type: CanvasNode['type'];
  readonly position: { x: number; y: number };
  readonly style: { width: number; height: number };
  readonly zIndex: number;
  readonly data: BoardNodeData;
}

export interface BoardFlowEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle: string;
  readonly targetHandle: string;
  readonly label?: string;
  readonly data: { readonly color?: CanvasColor; readonly fromEnd: EdgeEnd; readonly toEnd: EdgeEnd };
}

/** Preset 1-6 -> a real design-system tag color token (see porcelain-theme.css), not an invented palette. */
const PRESET_COLOR_VAR: Record<string, string> = {
  '1': 'var(--tag-red)',
  '2': 'var(--tag-orange)',
  '3': 'var(--tag-yellow)',
  '4': 'var(--tag-green)',
  '5': 'var(--tag-sky)',
  '6': 'var(--tag-purple)',
};

/** Resolves a canvasColor (preset "1"-"6" or hex) to a usable CSS color value. */
export function resolveNodeColor(color: CanvasColor | undefined): string | undefined {
  if (!color) return undefined;
  return PRESET_COLOR_VAR[color] ?? color;
}

/** Handle id a side resolves to for the "source" role. Nodes render both a source and target handle per side. */
export function sourceHandleId(side: NodeSide | undefined): string {
  return `${side ?? 'bottom'}-source`;
}

export function targetHandleId(side: NodeSide | undefined): string {
  return `${side ?? 'top'}-target`;
}

function nodeZIndex(node: CanvasNode, index: number): number {
  // Groups render as backdrops behind everything placed after them, matching
  // the spec's "ascending z-index by array order" rule; other nodes keep
  // their array position too so drag-reordering (WS4 doesn't reorder yet)
  // stays faithful to source order.
  return node.type === 'group' ? index : index + 1000;
}

/** Converts a parsed JSONCanvas into React Flow node/edge props (position/size come straight from the canvas). */
export function canvasToFlow(canvas: JSONCanvas): { nodes: BoardFlowNode[]; edges: BoardFlowEdge[] } {
  const nodes: BoardFlowNode[] = canvas.nodes.map((node, index) => ({
    id: node.id,
    type: node.type,
    position: { x: node.x, y: node.y },
    style: { width: node.width, height: node.height },
    zIndex: nodeZIndex(node, index),
    data: { node },
  }));

  const edges: BoardFlowEdge[] = canvas.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: sourceHandleId(edge.fromSide),
    targetHandle: targetHandleId(edge.toSide),
    label: edge.label,
    data: { color: edge.color, fromEnd: edge.fromEnd ?? 'none', toEnd: edge.toEnd ?? 'arrow' },
  }));

  return { nodes, edges };
}

/** Applies a batch of (id -> position) updates, e.g. after a drag gesture. Unknown ids are ignored. */
export function applyNodePositions(canvas: JSONCanvas, positions: ReadonlyMap<string, { x: number; y: number }>): JSONCanvas {
  if (positions.size === 0) return canvas;
  return {
    ...canvas,
    nodes: canvas.nodes.map((node) => {
      const next = positions.get(node.id);
      return next ? { ...node, x: Math.round(next.x), y: Math.round(next.y) } : node;
    }),
  };
}

/** Updates a text node's text content. No-op if the id isn't a text node. */
export function updateNodeText(canvas: JSONCanvas, id: string, text: string): JSONCanvas {
  return {
    ...canvas,
    nodes: canvas.nodes.map((node) => (node.id === id && node.type === 'text' ? { ...node, text } : node)),
  };
}

/** Appends a new text node at the given position with a default size. */
export function addTextNode(
  canvas: JSONCanvas,
  params: { id: string; x: number; y: number; text?: string },
): JSONCanvas {
  const node: CanvasNode = {
    id: params.id,
    type: 'text',
    x: Math.round(params.x),
    y: Math.round(params.y),
    width: 240,
    height: 120,
    text: params.text ?? '',
  };
  return { ...canvas, nodes: [...canvas.nodes, node] };
}

/** Removes nodes by id, and any edges that referenced them (keeps the graph internally consistent). */
export function removeNodes(canvas: JSONCanvas, ids: readonly string[]): JSONCanvas {
  if (ids.length === 0) return canvas;
  const idSet = new Set(ids);
  return {
    nodes: canvas.nodes.filter((n) => !idSet.has(n.id)),
    edges: canvas.edges.filter((e) => !idSet.has(e.fromNode) && !idSet.has(e.toNode)),
  };
}
