// Pure layout for the patent diagram renderer (SPEC-SCENE-OS-WOW D3).
//
// Parses the first-class patent atoms from scene-os-core/patent.rs into placed
// nodes, edges, and callouts with a self-computed layered layout (the backend
// leaves `patent-node.position` None). Kept dependency-free and side-effect-free
// so it is unit-testable in the repo's node test environment and reusable by
// both the 2D SVG renderer and the scene3d R3F variant (PT-032).

import type { SceneAtom, SceneRelation, SourceRef } from '@/lib/scene-package';

export const NODE_W = 158;
export const NODE_H = 52;
export const LAYER_GAP = 128;
export const NODE_GAP = 44;
export const PAD = 64;
export const CALLOUT_REACH = 48;
export const CALLOUT_STACK = 26;

export interface PlacedNode {
  id: string;
  label: string;
  cx: number;
  cy: number;
  x: number;
  y: number;
}

export interface PlacedEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PlacedCallout {
  id: string;
  numeral: string;
  description: string;
  nodeId: string;
  nodeLabel: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  evidence: SourceRef[];
}

export interface PatentLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  callouts: PlacedCallout[];
  viewBox: string;
}

function readMeta(atom: SceneAtom, key: string): unknown {
  return atom.metadata?.[key];
}

/** Longest-path depth from sources: source nodes land at depth 0, downstream
 * nodes at max(incoming) + 1. Cycles are broken by a visiting guard. */
export function computeDepths(
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>,
): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const id of nodeIds) incoming.set(id, []);
  for (const edge of edges) {
    if (incoming.has(edge.target) && incoming.has(edge.source)) {
      incoming.get(edge.target)!.push(edge.source);
    }
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const source of incoming.get(id) ?? []) d = Math.max(d, resolve(source) + 1);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const id of nodeIds) resolve(id);
  return depth;
}

export function buildPatentLayout(atoms: SceneAtom[], relations: SceneRelation[]): PatentLayout {
  const nodeAtoms = atoms.filter((atom) => atom.kind === 'patent-node');
  const calloutAtoms = atoms.filter((atom) => atom.kind === 'patent-callout');
  const edgeRelations = relations.filter((relation) => relation.kind === 'patent-edge');
  const leaderRelations = relations.filter((relation) => relation.kind === 'patent-callout-leader');

  const nodeIds = nodeAtoms.map((atom) => atom.id);
  const depths = computeDepths(
    nodeIds,
    edgeRelations.map((relation) => ({ source: relation.sourceId, target: relation.targetId })),
  );

  // Group node ids by depth, preserving first-seen order within a layer.
  const layers = new Map<number, string[]>();
  for (const atom of nodeAtoms) {
    const depth = depths.get(atom.id) ?? 0;
    if (!layers.has(depth)) layers.set(depth, []);
    layers.get(depth)!.push(atom.id);
  }
  const maxCount = Math.max(1, ...Array.from(layers.values(), (ids) => ids.length));
  const figureWidth = maxCount * NODE_W + (maxCount - 1) * NODE_GAP;

  const placedById = new Map<string, PlacedNode>();
  const labelById = new Map(nodeAtoms.map((atom) => [atom.id, atom.label ?? atom.id] as const));
  const sortedDepths = Array.from(layers.keys()).sort((a, b) => a - b);
  for (const depth of sortedDepths) {
    const ids = layers.get(depth)!;
    const rowWidth = ids.length * NODE_W + (ids.length - 1) * NODE_GAP;
    const startX = PAD + (figureWidth - rowWidth) / 2;
    ids.forEach((id, index) => {
      const x = startX + index * (NODE_W + NODE_GAP);
      const y = PAD + depth * LAYER_GAP;
      placedById.set(id, { id, label: labelById.get(id) ?? id, x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 });
    });
  }
  const nodes = Array.from(placedById.values());

  const edges = edgeRelations
    .map((relation): PlacedEdge | null => {
      const source = placedById.get(relation.sourceId);
      const target = placedById.get(relation.targetId);
      if (!source || !target) return null;
      return { id: relation.id, x1: source.cx, y1: source.cy, x2: target.cx, y2: target.cy };
    })
    .filter((edge): edge is PlacedEdge => edge !== null);

  // callout -> node comes from the leader relation (reliable, never dangling).
  const nodeByCallout = new Map<string, string>();
  for (const leader of leaderRelations) nodeByCallout.set(leader.sourceId, leader.targetId);

  const figureCenterX = PAD + figureWidth / 2;
  const stackIndex = new Map<string, number>();
  const stackTotal = new Map<string, number>();
  for (const callout of calloutAtoms) {
    const nodeId = nodeByCallout.get(callout.id);
    if (nodeId) stackTotal.set(nodeId, (stackTotal.get(nodeId) ?? 0) + 1);
  }

  const callouts: PlacedCallout[] = [];
  for (const atom of calloutAtoms) {
    const nodeId = nodeByCallout.get(atom.id);
    const node = nodeId ? placedById.get(nodeId) : undefined;
    if (!node) continue;
    const total = stackTotal.get(node.id) ?? 1;
    const index = stackIndex.get(node.id) ?? 0;
    stackIndex.set(node.id, index + 1);
    const side = node.cx >= figureCenterX ? -1 : 1;
    const anchorX = node.cx + side * (NODE_W / 2);
    const anchorY = node.cy;
    const x = node.cx + side * (NODE_W / 2 + CALLOUT_REACH);
    const y = node.cy + (index - (total - 1) / 2) * CALLOUT_STACK;
    callouts.push({
      id: atom.id,
      numeral: atom.label ?? String(readMeta(atom, 'numeral') ?? '?'),
      description: String(readMeta(atom, 'description') ?? ''),
      nodeId: node.id,
      nodeLabel: node.label,
      x,
      y,
      anchorX,
      anchorY,
      evidence: atom.sourceRefs ?? [],
    });
  }

  // Bounds over everything drawn (+ padding) so the viewBox always fits.
  const xs = [...nodes.map((n) => n.x), ...nodes.map((n) => n.x + NODE_W), ...callouts.map((c) => c.x)];
  const ys = [...nodes.map((n) => n.y), ...nodes.map((n) => n.y + NODE_H), ...callouts.map((c) => c.y)];
  const minX = Math.min(PAD, ...xs) - 40;
  const minY = Math.min(PAD, ...ys) - 40;
  const maxX = Math.max(PAD + figureWidth, ...xs) + 60;
  const maxY = Math.max(PAD, ...ys) + 60;

  return { nodes, edges, callouts, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
}
