// SOURCING: none — the canvas layout document (issue 144, standing law).
//
// Positions, frame membership, edge waypoints, collapse, and port visibility
// all live here. None of it is content identity: deleting this document must
// lose only arrangement, never meaning. That is why frame membership is
// *derived from geometry* on read rather than stored as an edge -- a node
// belongs to a frame because it sits inside it, not because something wrote a
// relationship down.
//
// The wire form is the object the program canvas already round-trips through
// `programmable_graph_apply` (`program.layout`), which the server stores
// opaquely. Extra keys are additive and need no backend change.

import type { Point } from '../edges/waypoints';

export interface NodeLayout {
  readonly x: number;
  readonly y: number;
  readonly collapsed?: boolean;
  readonly advancedOpen?: boolean;
  /** Ports the reader has hidden on this node. */
  readonly hiddenPorts?: readonly string[];
  /**
   * Last frame this node resolved into. Cached so a node dragged out of every
   * frame and back lands in the same one, and so headless consumers do not have
   * to recompute geometry. `frameMembership` is still the authority.
   */
  readonly frameId?: string;
}

export interface EdgeLayout {
  readonly waypoints?: readonly Point[];
}

export interface FrameLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly title?: string;
}

export interface CanvasLayoutDocument {
  readonly nodes: Readonly<Record<string, NodeLayout>>;
  readonly edges: Readonly<Record<string, EdgeLayout>>;
  readonly frames: Readonly<Record<string, FrameLayout>>;
}

export const EMPTY_LAYOUT: CanvasLayoutDocument = {
  nodes: {},
  edges: {},
  frames: {},
};

export interface NodeBox extends Point {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

function contains(frame: FrameLayout, node: NodeBox): boolean {
  return (
    node.x >= frame.x &&
    node.y >= frame.y &&
    node.x + node.width <= frame.x + frame.width &&
    node.y + node.height <= frame.y + frame.height
  );
}

function area(frame: FrameLayout): number {
  return frame.width * frame.height;
}

/**
 * Resolve which frame owns each node. Membership is geometry: a node belongs to
 * the smallest frame that fully contains it, so nesting a small frame inside a
 * large one gives the inner frame the node. Nodes inside no frame are absent
 * from the result rather than mapped to null.
 */
export function frameMembership(
  frames: Readonly<Record<string, FrameLayout>>,
  nodes: readonly NodeBox[],
): Readonly<Record<string, string>> {
  const entries = Object.entries(frames);
  const membership: Record<string, string> = {};
  for (const node of nodes) {
    let owner: string | undefined;
    let ownerArea = Number.POSITIVE_INFINITY;
    for (const [frameId, frame] of entries) {
      if (!contains(frame, node)) continue;
      const size = area(frame);
      if (size < ownerArea) {
        owner = frameId;
        ownerArea = size;
      }
    }
    if (owner) membership[node.id] = owner;
  }
  return membership;
}

/** Node ids a frame owns, in the order given. */
export function frameMembers(
  frameId: string,
  membership: Readonly<Record<string, string>>,
): readonly string[] {
  return Object.keys(membership).filter((nodeId) => membership[nodeId] === frameId);
}

export function nodeLayout(
  document: CanvasLayoutDocument,
  nodeId: string,
): NodeLayout | undefined {
  return document.nodes[nodeId];
}

export function edgeWaypoints(
  document: CanvasLayoutDocument,
  edgeId: string,
): readonly Point[] {
  return document.edges[edgeId]?.waypoints ?? [];
}

export function withEdgeWaypoints(
  document: CanvasLayoutDocument,
  edgeId: string,
  waypoints: readonly Point[],
): CanvasLayoutDocument {
  const edges = { ...document.edges };
  if (waypoints.length === 0) {
    delete edges[edgeId];
  } else {
    edges[edgeId] = { ...edges[edgeId], waypoints: [...waypoints] };
  }
  return { ...document, edges };
}

export function withNodeLayout(
  document: CanvasLayoutDocument,
  nodeId: string,
  patch: Partial<NodeLayout>,
): CanvasLayoutDocument {
  const previous = document.nodes[nodeId] ?? { x: 0, y: 0 };
  return {
    ...document,
    nodes: { ...document.nodes, [nodeId]: { ...previous, ...patch } },
  };
}

export function withFrame(
  document: CanvasLayoutDocument,
  frameId: string,
  frame: FrameLayout,
): CanvasLayoutDocument {
  return { ...document, frames: { ...document.frames, [frameId]: frame } };
}

export function withoutFrame(
  document: CanvasLayoutDocument,
  frameId: string,
): CanvasLayoutDocument {
  const frames = { ...document.frames };
  delete frames[frameId];
  const nodes = Object.fromEntries(
    Object.entries(document.nodes).map(([nodeId, layout]) =>
      layout.frameId === frameId
        ? [nodeId, { ...layout, frameId: undefined }]
        : [nodeId, layout],
    ),
  );
  return { ...document, frames, nodes };
}

/** Ports a node hides, as a set for cheap lookup during render. */
export function hiddenPorts(
  document: CanvasLayoutDocument,
  nodeId: string,
): ReadonlySet<string> {
  return new Set(document.nodes[nodeId]?.hiddenPorts ?? []);
}

export function togglePortVisibility(
  document: CanvasLayoutDocument,
  nodeId: string,
  portId: string,
): CanvasLayoutDocument {
  const current = new Set(document.nodes[nodeId]?.hiddenPorts ?? []);
  if (current.has(portId)) {
    current.delete(portId);
  } else {
    current.add(portId);
  }
  return withNodeLayout(document, nodeId, {
    hiddenPorts: current.size === 0 ? undefined : [...current].sort(),
  });
}

// --- wire round-trip -------------------------------------------------------

/**
 * The shape `programmable_graph_apply` already accepts. `nodes` and
 * `node_metadata` are the keys the program canvas shipped with; `edges` and
 * `frames` are additive and land in the same opaque `program.layout` object.
 */
export interface CanvasLayoutWire {
  readonly nodes: Record<string, { x: number; y: number }>;
  readonly node_metadata?: Record<
    string,
    {
      collapsed?: boolean;
      advanced_open?: boolean;
      hidden_ports?: string[];
      frame_id?: string;
      /** Read for compatibility with layouts written before frames existed. */
      group_id?: string;
    }
  >;
  readonly edge_metadata?: Record<string, { waypoints?: { x: number; y: number }[] }>;
  readonly frames?: Record<
    string,
    { x: number; y: number; width: number; height: number; title?: string }
  >;
}

export function toLayoutWire(document: CanvasLayoutDocument): CanvasLayoutWire {
  const nodes: CanvasLayoutWire['nodes'] = {};
  const nodeMetadata: NonNullable<CanvasLayoutWire['node_metadata']> = {};
  for (const [nodeId, layout] of Object.entries(document.nodes)) {
    nodes[nodeId] = { x: layout.x, y: layout.y };
    const metadata: NonNullable<CanvasLayoutWire['node_metadata']>[string] = {};
    if (layout.collapsed) metadata.collapsed = true;
    if (layout.advancedOpen) metadata.advanced_open = true;
    if (layout.hiddenPorts?.length) metadata.hidden_ports = [...layout.hiddenPorts];
    if (layout.frameId) metadata.frame_id = layout.frameId;
    if (Object.keys(metadata).length > 0) nodeMetadata[nodeId] = metadata;
  }

  const edgeMetadata: NonNullable<CanvasLayoutWire['edge_metadata']> = {};
  for (const [edgeId, layout] of Object.entries(document.edges)) {
    if (!layout.waypoints?.length) continue;
    edgeMetadata[edgeId] = {
      waypoints: layout.waypoints.map((point) => ({ x: point.x, y: point.y })),
    };
  }

  const wire: CanvasLayoutWire = {
    nodes,
    ...(Object.keys(nodeMetadata).length > 0 ? { node_metadata: nodeMetadata } : {}),
    ...(Object.keys(edgeMetadata).length > 0 ? { edge_metadata: edgeMetadata } : {}),
    ...(Object.keys(document.frames).length > 0 ? { frames: { ...document.frames } } : {}),
  };
  return wire;
}

function readPoints(value: unknown): Point[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const point = entry as Record<string, unknown>;
    if (typeof point.x !== 'number' || typeof point.y !== 'number') return [];
    return [{ x: point.x, y: point.y }];
  });
}

export function fromLayoutWire(wire: CanvasLayoutWire | undefined): CanvasLayoutDocument {
  if (!wire || typeof wire.nodes !== 'object' || wire.nodes === null) return EMPTY_LAYOUT;
  const nodes: Record<string, NodeLayout> = {};
  for (const [nodeId, position] of Object.entries(wire.nodes)) {
    if (typeof position?.x !== 'number' || typeof position?.y !== 'number') continue;
    const metadata = wire.node_metadata?.[nodeId];
    nodes[nodeId] = {
      x: position.x,
      y: position.y,
      ...(metadata?.collapsed ? { collapsed: true } : {}),
      ...(metadata?.advanced_open ? { advancedOpen: true } : {}),
      ...(metadata?.hidden_ports?.length
        ? { hiddenPorts: [...metadata.hidden_ports] }
        : {}),
      // `group_id` is the pre-frame spelling; read it so older saved layouts
      // keep their grouping instead of silently flattening.
      ...(metadata?.frame_id ?? metadata?.group_id
        ? { frameId: metadata.frame_id ?? metadata.group_id }
        : {}),
    };
  }

  const edges: Record<string, EdgeLayout> = {};
  for (const [edgeId, metadata] of Object.entries(wire.edge_metadata ?? {})) {
    const waypoints = readPoints(metadata?.waypoints);
    if (waypoints.length > 0) edges[edgeId] = { waypoints };
  }

  const frames: Record<string, FrameLayout> = {};
  for (const [frameId, frame] of Object.entries(wire.frames ?? {})) {
    if (
      typeof frame?.x !== 'number' ||
      typeof frame?.y !== 'number' ||
      typeof frame?.width !== 'number' ||
      typeof frame?.height !== 'number'
    ) {
      continue;
    }
    frames[frameId] = {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      ...(typeof frame.title === 'string' ? { title: frame.title } : {}),
    };
  }

  return { nodes, edges, frames };
}
