import { describe, expect, it } from 'vitest';
import {
  constellationFromFind,
  constellationFromScatter,
} from './projection';
import { find, scatter } from './__tests__/fixtures';

describe('constellation projection', () => {
  it('keeps all aspects and their graph relation', () => {
    const payload = constellationFromScatter(scatter());
    expect(payload.nodes).toHaveLength(3);
    expect(payload.nodes.at(-1)?.relation).toBe('ORPHAN');
  });

  it('draws aspect edges only for shared seed evidence', () => {
    const payload = constellationFromScatter(scatter());
    expect(payload.edges).toHaveLength(1);
    expect(payload.edges[0].reason.type).toBe('shared_source');
    expect(payload.edges[0].reason.evidenceRefs).toContain('page');
  });

  it('uses the scatter reference as provenance', () => {
    expect(constellationFromScatter(scatter()).meta.subgraphRef).toBe(
      'scatter-1',
    );
  });

  it('projects one result node per document', () => {
    const response = find();
    const duplicated = {
      ...response,
      results: [...response.results, {
        ...response.results[0],
        score: 0.1,
      }],
    };
    expect(constellationFromFind(duplicated).nodes).toHaveLength(
      response.results.length,
    );
  });

  it('cites every real graph edge', () => {
    for (const edge of constellationFromFind(find()).edges) {
      expect(edge.reason.type).toBe('graph_edge');
      expect(edge.reason.evidenceRefs.length).toBeGreaterThan(0);
    }
  });

  it('surfaces a degraded lane in query metadata', () => {
    expect(
      constellationFromFind(find()).meta.degradedProviders.join(' '),
    ).toContain('STRUCTURAL');
  });
});
