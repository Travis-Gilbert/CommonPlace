// SOURCING: d3 force simulation and seeded random source. CSS-free pure geometry.

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  randomLcg,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3';

export type ConstellationNodeKind = 'result' | 'memory';

export interface ConstellationLayoutNode {
  readonly id: string;
  readonly kind: ConstellationNodeKind;
}

export interface ConstellationLayoutEdge {
  readonly source: string;
  readonly target: string;
}

export interface ConstellationPoint {
  readonly x: number;
  readonly y: number;
}

export interface ConstellationLayoutInput {
  readonly query: string;
  readonly nodes: readonly ConstellationLayoutNode[];
  readonly edges: readonly ConstellationLayoutEdge[];
  readonly width: number;
  readonly height: number;
  readonly placed?: ReadonlyMap<string, ConstellationPoint>;
}

export type ConstellationLayout = Map<string, ConstellationPoint>;

export const CONSTELLATION_NODE_RADIUS = 86;
export const CONSTELLATION_MEMORY_RADIUS = 62;

const ALPHA_MIN = 0.001;
const ALPHA_DECAY = 0.0228;
const LINK_DISTANCE = 230;
const CHARGE_STRENGTH = -1_400;
const FIT_PADDING = 24;

interface SimNode extends SimulationNodeDatum {
  readonly id: string;
  readonly kind: ConstellationNodeKind;
}

type SimLink = SimulationLinkDatum<SimNode>;

export function layoutConstellation(
  input: ConstellationLayoutInput,
): ConstellationLayout {
  const { nodes, edges, width, height, placed } = input;
  if (nodes.length === 0) return new Map();

  const random = randomLcg(
    constellationSeedFraction(input.query, nodes.map((node) => node.id)),
  );
  const ids = new Set(nodes.map((node) => node.id));
  const simNodes: SimNode[] = nodes.map((node, index) => {
    const pin = placed?.get(node.id);
    if (pin) {
      return {
        id: node.id,
        kind: node.kind,
        x: pin.x,
        y: pin.y,
        fx: pin.x,
        fy: pin.y,
      };
    }
    const angle = random() * Math.PI * 2;
    const radius = (0.25 + random() * 0.25) * Math.min(width, height);
    return {
      id: node.id,
      kind: node.kind,
      x: width / 2 + Math.cos(angle) * radius + index * 1e-3,
      y: height / 2 + Math.sin(angle) * radius,
    };
  });
  const links: SimLink[] = edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => ({ source: edge.source, target: edge.target }));

  const simulation = forceSimulation<SimNode>(simNodes)
    .randomSource(random)
    .alpha(1)
    .alphaMin(ALPHA_MIN)
    .alphaDecay(ALPHA_DECAY)
    .velocityDecay(0.4)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((node) => node.id)
        .distance(LINK_DISTANCE)
        .strength(0.35),
    )
    .force(
      'charge',
      forceManyBody<SimNode>().strength(CHARGE_STRENGTH).distanceMax(900),
    )
    .force('center', forceCenter<SimNode>(width / 2, height / 2).strength(0.6))
    .force(
      'collide',
      forceCollide<SimNode>((node) =>
        node.kind === 'memory'
          ? CONSTELLATION_MEMORY_RADIUS
          : CONSTELLATION_NODE_RADIUS,
      ).strength(0.9),
    )
    .stop();

  const ticks = Math.ceil(Math.log(ALPHA_MIN) / Math.log(1 - ALPHA_DECAY));
  for (let step = 0; step < ticks; step += 1) simulation.tick();
  simulation.stop();

  const points = simNodes.map((node) => ({
    x: node.x ?? width / 2,
    y: node.y ?? height / 2,
  }));
  const fitted =
    placed && placed.size > 0
      ? points
      : fitToViewport(
          points,
          simNodes.map((node) =>
            node.kind === 'memory'
              ? CONSTELLATION_MEMORY_RADIUS
              : CONSTELLATION_NODE_RADIUS,
          ),
          width,
          height,
        );
  const layout: ConstellationLayout = new Map();
  simNodes.forEach((node, index) => {
    const pin = placed?.get(node.id);
    layout.set(node.id, pin ?? {
      x: round3(fitted[index].x),
      y: round3(fitted[index].y),
    });
  });
  return layout;
}

export function constellationSeed(
  query: string,
  nodeIds: readonly string[],
): number {
  const material = `${query}\0${[...nodeIds].sort().join('\x01')}`;
  let hash = 5381;
  for (let index = 0; index < material.length; index += 1) {
    hash = ((hash << 5) + hash + material.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function constellationSeedFraction(
  query: string,
  nodeIds: readonly string[],
): number {
  return constellationSeed(query, nodeIds) / 2 ** 32;
}

function fitToViewport(
  points: readonly ConstellationPoint[],
  radii: readonly number[],
  width: number,
  height: number,
): ConstellationPoint[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const nodeExtent = Math.max(...radii, 0);
  const inset = FIT_PADDING + nodeExtent;
  const scale = Math.min(
    1,
    Math.max(width - inset * 2, 1) / spanX,
    Math.max(height - inset * 2, 1) / spanY,
  );
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return points.map((point) => ({
    x: width / 2 + (point.x - centerX) * scale,
    y: height / 2 + (point.y - centerY) * scale,
  }));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
