import { describe, expect, it } from 'vitest';
import {
  CONSTELLATION_FULL_FIXTURE,
  CONSTELLATION_OVERSIZED_FIXTURE,
  CONSTELLATION_STATE_FIXTURES,
  CONSTELLATION_ZERO_EDGE_FIXTURE,
} from '@commonplace/block-view-contracts/search-stack-fixture';
import {
  capConstellationPayload,
  constellationDegradedNotes,
  parseConstellationPayload,
  parseConstellationState,
} from './payload';

describe('constellation payload boundary', () => {
  it('accepts a full payload', () => {
    const parsed = parseConstellationPayload(CONSTELLATION_FULL_FIXTURE);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.payload.nodes).toHaveLength(8);
      expect(parsed.payload.memoryNodes).toHaveLength(2);
    }
  });

  it('accepts an honest zero-edge payload', () => {
    const parsed = parseConstellationPayload(CONSTELLATION_ZERO_EDGE_FIXTURE);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.payload.edges).toHaveLength(0);
  });

  it('refuses an edge with no evidence reference', () => {
    const parsed = parseConstellationPayload({
      ...CONSTELLATION_FULL_FIXTURE,
      edges: [{
        source: 'r1',
        target: 'r2',
        reason: {
          type: 'citation',
          text: 'Unproved',
          evidenceRefs: [],
        },
      }],
    });
    expect(parsed.ok).toBe(false);
  });

  it('caps nodes and removes dangling edges', () => {
    const capped = capConstellationPayload(
      CONSTELLATION_OVERSIZED_FIXTURE,
    );
    expect(capped.nodes).toHaveLength(8);
    expect(capped.memoryNodes).toHaveLength(2);
    const ids = new Set([
      ...capped.nodes.map((node) => node.id),
      ...capped.memoryNodes.map((node) => node.id),
    ]);
    expect(
      capped.edges.every(
        (edge) => ids.has(edge.source) && ids.has(edge.target),
      ),
    ).toBe(true);
  });

  it('round trips all five states', () => {
    for (const [kind, state] of Object.entries(
      CONSTELLATION_STATE_FIXTURES,
    )) {
      expect(parseConstellationState(state).kind).toBe(kind);
    }
  });

  it('surfaces provider degradation once', () => {
    const notes = constellationDegradedNotes(
      CONSTELLATION_STATE_FIXTURES.partial,
    );
    expect(notes.join(' ')).toContain('brave');
    expect(notes.join(' ')).toContain('crossref');
  });
});
