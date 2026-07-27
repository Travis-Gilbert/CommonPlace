// SOURCING: extracted wire-to-wire constellation projection. Pure logic only.

import type {
  AspectNode,
  ConstellationEdge,
  ConstellationNode,
  ConstellationPayload,
  FindHit,
  FindResponse,
  FindResult,
  ScatterResponse,
} from './contracts';
import { capConstellationPayload } from './payload';

export function constellationFromScatter(
  scatter: ScatterResponse,
): ConstellationPayload {
  const nodes: ConstellationNode[] = scatter.aspects.map((aspect, index) => ({
    id: aspect.id,
    url:
      topSeedSource(aspect)
      ?? `commonplace:scene:${scatter.scene?.sceneId ?? scatter.scatterRef}`,
    title: aspect.label,
    description: seedSummary(aspect),
    admittedRank: index + 1,
    relation: aspect.relation,
  }));
  const byId = new Map(
    scatter.aspects.map((aspect) => [aspect.id, aspect] as const),
  );
  const edges: ConstellationEdge[] = [];
  const seen = new Set<string>();

  for (const aspect of scatter.aspects) {
    for (const adjacency of aspect.edges) {
      const target = byId.get(adjacency.target);
      if (!target || target.id === aspect.id) continue;
      const pair = [aspect.id, target.id].sort().join('::');
      if (seen.has(pair)) continue;
      const shared = sharedDocs(aspect, target);
      if (shared.length === 0) continue;
      seen.add(pair);
      edges.push({
        source: aspect.id,
        target: target.id,
        reason: {
          type: 'shared_source',
          text: `Both aspects were seeded by ${describeDocs(shared)}.`,
          evidenceRefs: shared,
        },
      });
    }
  }

  return capConstellationPayload({
    nodes,
    edges,
    memoryNodes: [],
    meta: {
      query: scatter.query,
      subgraphRef: scatter.scatterRef,
      tokensAdmitted: 0,
      tokensDeferred: 0,
      degradedProviders: scatter.sceneRefusal ? [scatter.sceneRefusal] : [],
    },
  });
}

export function constellationFromFind(
  find: FindResponse,
): ConstellationPayload {
  const results = dedupeByDoc(find.results);
  const nodes: ConstellationNode[] = results.map((result, index) => ({
    id: result.hit.doc,
    url: result.hit.source ?? `commonplace:${result.hit.doc}`,
    title: result.hit.title ?? result.hit.doc,
    description: result.hit.snippet,
    admittedRank: index + 1,
    relation: result.relation,
  }));
  const present = new Set(nodes.map((node) => node.id));
  const titles = new Map(nodes.map((node) => [node.id, node.title] as const));
  const edges: ConstellationEdge[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    for (const edge of result.edges) {
      if (!present.has(edge.fromId) || !present.has(edge.toId)) continue;
      const key = `${[edge.fromId, edge.toId].sort().join('::')}::${edge.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        source: edge.fromId,
        target: edge.toId,
        reason: {
          type: 'graph_edge',
          text: `${titles.get(edge.fromId) ?? edge.fromId} and ${
            titles.get(edge.toId) ?? edge.toId
          } are connected by ${edge.type}.`,
          evidenceRefs: [edge.id],
        },
      });
    }
  }

  return capConstellationPayload({
    nodes,
    edges,
    memoryNodes: [],
    meta: {
      query: find.query,
      subgraphRef: find.retrievalRef,
      tokensAdmitted: 0,
      tokensDeferred: 0,
      degradedProviders: find.lanes
        .filter((receipt) => Boolean(receipt.degradedReason))
        .map(
          (receipt) =>
            `${receipt.lane} lane (${receipt.degradedReason ?? 'unknown cause'})`,
        ),
    },
  });
}

function sharedDocs(left: AspectNode, right: AspectNode): string[] {
  const rightDocs = new Set(right.seedHits.map((hit) => hit.doc));
  return [...new Set(
    left.seedHits
      .filter((hit) => rightDocs.has(hit.doc))
      .map((hit) => hit.doc),
  )].sort();
}

function describeDocs(docs: readonly string[]): string {
  return docs.length === 1 ? docs[0] : `${docs.length} documents in common`;
}

function topSeedSource(aspect: AspectNode): string | undefined {
  return aspect.seedHits.find((hit: FindHit) => Boolean(hit.source))?.source;
}

function seedSummary(aspect: AspectNode): string | undefined {
  const top = aspect.seedHits[0];
  if (!top) return undefined;
  const noun = aspect.seedHits.length === 1 ? 'seed' : 'seeds';
  return `${aspect.seedHits.length} ${noun}, from ${top.title ?? top.doc}`;
}

function dedupeByDoc(results: readonly FindResult[]): FindResult[] {
  const best = new Map<string, FindResult>();
  for (const result of results) {
    const current = best.get(result.hit.doc);
    if (!current || result.score > current.score) {
      best.set(result.hit.doc, result);
    }
  }
  return results.filter((result) => best.get(result.hit.doc) === result);
}
