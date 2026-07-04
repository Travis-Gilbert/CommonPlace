'use client';

// Shared graph binding for the /v2 Graph surface (spec PT-007 V2 + PT-011 V6).
//
// Every graph view (cosmos.gl Network, D3 Ego, React Flow Models) reads its
// nodes from this one hook, so all three "bind the same community and
// centrality fields" as the spec requires. The fields follow the same
// derive-or-consume contract as `source.mode`: prefer the engine's authoritative
// community/centrality when the live payload carries them, derive an honest
// stand-in otherwise. When Codex's Leiden/PPR resolvers land, the `??` below is
// the entire live-flip -- no view changes.

import { useMemo } from 'react';
import { useCommonplaceRustyRedData } from '@/lib/commonplace/rustyred-data-client';
import type {
  CommonplaceRustyRedDataSource,
  CommonplaceRustyRedGraphLink,
  CommonplaceRustyRedGraphNode,
} from '@/lib/commonplace/rustyred-data-contract';

export interface V2GraphNode extends CommonplaceRustyRedGraphNode {
  community: number;
  centrality: number;
}

export interface V2GraphData {
  nodes: readonly V2GraphNode[];
  links: readonly CommonplaceRustyRedGraphLink[];
  source: CommonplaceRustyRedDataSource;
  isLoading: boolean;
  byId: ReadonlyMap<string, V2GraphNode>;
  adjacency: ReadonlyMap<string, readonly string[]>;
  communityCount: number;
}

// ponytail: ordinal data-viz palette. WebGL and canvas cannot read CSS custom
// properties, so the graph palette lives here as the single source (the design
// system's token layer stays hex-free). Okabe-Ito colorblind-safe hues in
// 0..1 RGB; community index wraps. Upgrade path: none needed -- 8 hues cover
// the community count RustyRed produces for a personal corpus.
export const COMMUNITY_PALETTE: readonly (readonly [number, number, number])[] = [
  [0.85, 0.37, 0.01], // vermilion
  [0.0, 0.62, 0.45], // teal
  [0.34, 0.71, 0.91], // sky
  [0.8, 0.47, 0.65], // mauve
  [0.58, 0.51, 0.0], // olive
  [0.0, 0.45, 0.7], // blue
  [0.9, 0.62, 0.0], // amber
  [0.55, 0.34, 0.64], // purple
];

export function communityRgb(community: number): readonly [number, number, number] {
  const n = COMMUNITY_PALETTE.length;
  return COMMUNITY_PALETTE[((community % n) + n) % n];
}

/** CSS `rgb()` string for the same palette, so SVG/React Flow views match the
 *  WebGL canvas exactly (one palette, three renderers). */
export function communityCss(community: number, alpha = 1): string {
  const [r, g, b] = communityRgb(community);
  const to255 = (v: number) => Math.round(v * 255);
  return alpha >= 1
    ? `rgb(${to255(r)} ${to255(g)} ${to255(b)})`
    : `rgb(${to255(r)} ${to255(g)} ${to255(b)} / ${alpha})`;
}

/** Node render radius from centrality, on a legible floor..ceiling range. */
export function nodeRadius(centrality: number, floor = 4, ceil = 16): number {
  return floor + Math.max(0, Math.min(1, centrality)) * (ceil - floor);
}

/** Shared cross-filter predicate (spec PT-011): a community selection made in
 *  any view filters all others. `null` or empty means no brush -> everything
 *  is active. Every view dims/hides nodes for which this returns false. */
export function isCommunityActive(community: number, selected: readonly number[] | null): boolean {
  return !selected || selected.length === 0 || selected.includes(community);
}

// derive-or-consume: keep engine-provided fields, fill the rest from structure.
// community = connected component (union-find); centrality = normalized degree.
function resolveGraphFields(
  nodes: readonly CommonplaceRustyRedGraphNode[],
  links: readonly CommonplaceRustyRedGraphLink[],
): { nodes: readonly V2GraphNode[]; communityCount: number } {
  const index = new Map<string, number>();
  nodes.forEach((node, i) => index.set(node.id, i));

  const parent = nodes.map((_, i) => i);
  const find = (a: number): number => {
    let root = a;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]];
      root = parent[root];
    }
    return root;
  };

  const degree = new Array<number>(nodes.length).fill(0);
  for (const link of links) {
    const s = index.get(link.source);
    const t = index.get(link.target);
    if (s === undefined || t === undefined) continue;
    degree[s] += 1;
    degree[t] += 1;
    const rs = find(s);
    const rt = find(t);
    if (rs !== rt) parent[Math.max(rs, rt)] = Math.min(rs, rt);
  }

  // Dense, first-seen community ids so the palette starts at 0.
  const dense = new Map<number, number>();
  const derivedCommunity = nodes.map((_, i) => {
    const root = find(i);
    let id = dense.get(root);
    if (id === undefined) {
      id = dense.size;
      dense.set(root, id);
    }
    return id;
  });

  const maxDegree = degree.reduce((max, d) => Math.max(max, d), 0);
  const resolved = nodes.map((node, i): V2GraphNode => ({
    ...node,
    community: node.community ?? derivedCommunity[i],
    centrality: node.centrality ?? (maxDegree > 0 ? degree[i] / maxDegree : 0),
  }));

  const communityCount = new Set(resolved.map((n) => n.community)).size;
  return { nodes: resolved, communityCount };
}

export function useV2GraphData(): V2GraphData {
  const { payload, isLoading } = useCommonplaceRustyRedData('graph');

  return useMemo(() => {
    const links = payload.graph.links;
    const { nodes, communityCount } = resolveGraphFields(payload.graph.nodes, links);

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) adjacency.set(node.id, []);
    for (const link of links) {
      adjacency.get(link.source)?.push(link.target);
      adjacency.get(link.target)?.push(link.source);
    }

    return { nodes, links, source: payload.source, isLoading, byId, adjacency, communityCount };
  }, [payload, isLoading]);
}
