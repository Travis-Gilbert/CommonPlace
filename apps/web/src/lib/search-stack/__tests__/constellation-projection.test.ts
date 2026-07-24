/**
 * The evidence rule (HANDOFF-SEARCH-CONSTELLATION D1) as it applies to a
 * client-side projection: an edge exists only when something real can be cited
 * for it, and a query with no graph connection draws nodes and no edges rather
 * than failing.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_CONSTELLATION_RESULT_NODES,
  type FindResponse,
} from '@commonplace/block-view-contracts/search-stack';
import {
  constellationFromFind,
  constellationFromScatter,
} from '../constellation-projection';
import { fixtureAspectFind, fixtureOrphanFind, fixtureScatter } from '../fixtures';

describe('scatter projection (layer one)', () => {
  it('draws every aspect and keeps its relation annotation', () => {
    const payload = constellationFromScatter(fixtureScatter('membrane', 0.5));
    expect(payload.nodes).toHaveLength(3);
    expect(payload.nodes.map((node) => node.title)).toContain('Budget discipline');
    expect(payload.nodes.find((node) => node.title === 'Open frontier')?.relation).toBe('ORPHAN');
  });

  it('draws an aspect edge only when the two aspects share a seed document', () => {
    const payload = constellationFromScatter(fixtureScatter('membrane', 0.5));
    const pairs = payload.edges.map((edge) => [edge.source, edge.target].sort().join(' '));

    // budget and attention were both seeded by the page document.
    expect(pairs).toContain('aspect-attention aspect-budget');
    // budget and frontier are adjacent in the scatter but share no document, so
    // the only thing joining them is proximity, and proximity is not evidence.
    expect(pairs).not.toContain('aspect-budget aspect-frontier');
  });

  it('cites the shared documents as the edge evidence', () => {
    const payload = constellationFromScatter(fixtureScatter('membrane', 0.5));
    const edge = payload.edges[0];
    expect(edge.reason.type).toBe('shared_source');
    expect(edge.reason.evidenceRefs.length).toBeGreaterThan(0);
    expect(edge.reason.text.length).toBeGreaterThan(0);
  });

  it('carries the retrieval reference as the subgraph reference', () => {
    const scatter = fixtureScatter('membrane', 0.5);
    expect(constellationFromScatter(scatter).meta.subgraphRef).toBe(scatter.scatterRef);
  });

  it('emits no memory node rather than a placeholder gold node', () => {
    expect(constellationFromScatter(fixtureScatter('membrane', 0.5)).memoryNodes).toHaveLength(0);
  });
});

describe('find projection (layer two)', () => {
  it('draws a graph edge only when the response carried one, and cites its id', () => {
    const payload = constellationFromFind(fixtureAspectFind('membrane budget', 0.5));
    for (const edge of payload.edges) {
      expect(edge.reason.type).toBe('graph_edge');
      expect(edge.reason.evidenceRefs.length).toBeGreaterThan(0);
    }
  });

  it('renders a zero-edge response as all-orphan nodes and does not throw', () => {
    const payload = constellationFromFind(fixtureOrphanFind('membrane'));
    expect(payload.nodes.length).toBeGreaterThan(0);
    expect(payload.edges).toHaveLength(0);
    expect(payload.nodes.every((node) => node.relation === 'ORPHAN')).toBe(true);
  });

  it('surfaces a degraded lane as a degraded provider', () => {
    const payload = constellationFromFind(fixtureAspectFind('membrane budget', 0.5));
    expect(payload.meta.degradedProviders.join(' ')).toContain('STRUCTURAL');
  });

  it('caps the scene at the result node limit', () => {
    const base = fixtureAspectFind('membrane', 0.5);
    const many: FindResponse = {
      ...base,
      results: Array.from({ length: 20 }, (_, index) => ({
        ...base.results[0],
        hit: { ...base.results[0].hit, doc: `doc-${index}` },
        score: 1 - index / 100,
      })),
    };
    expect(constellationFromFind(many).nodes).toHaveLength(MAX_CONSTELLATION_RESULT_NODES);
  });

  it('draws one node per document when several lanes hit the same document', () => {
    const base = fixtureAspectFind('membrane', 0.5);
    const duplicated: FindResponse = {
      ...base,
      results: [
        base.results[0],
        { ...base.results[0], score: 0.1, hit: { ...base.results[0].hit, lane: 'SEMANTIC' } },
      ],
    };
    const payload = constellationFromFind(duplicated);
    expect(payload.nodes).toHaveLength(1);
  });
});
