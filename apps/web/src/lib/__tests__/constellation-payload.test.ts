import { describe, expect, it } from 'vitest';
import {
  MAX_CONSTELLATION_MEMORY_NODES,
  MAX_CONSTELLATION_RESULT_NODES,
} from '@commonplace/block-view-contracts/search-stack';
import {
  CONSTELLATION_FULL_FIXTURE,
  CONSTELLATION_NO_MEMORY_FIXTURE,
  CONSTELLATION_OVERSIZED_FIXTURE,
  CONSTELLATION_SCENE_PACKAGE_FIXTURE,
  CONSTELLATION_STATE_FIXTURES,
  CONSTELLATION_ZERO_EDGE_FIXTURE,
} from '@commonplace/block-view-contracts/search-stack-fixture';
import {
  capConstellationPayload,
  constellationDegradedNotes,
  parseConstellationPayload,
  parseConstellationState,
  readConstellationState,
} from '@/lib/constellation-payload';
import type { ScenePackageV2 } from '@/lib/scene-package';

describe('parseConstellationPayload', () => {
  it('accepts the full fixture unchanged', () => {
    const parsed = parseConstellationPayload(CONSTELLATION_FULL_FIXTURE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.payload.nodes).toHaveLength(8);
    expect(parsed.payload.memoryNodes).toHaveLength(2);
    expect(parsed.payload.edges).toHaveLength(CONSTELLATION_FULL_FIXTURE.edges.length);
  });

  it('accepts a zero edge constellation as a valid honest payload', () => {
    const parsed = parseConstellationPayload(CONSTELLATION_ZERO_EDGE_FIXTURE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.payload.edges).toHaveLength(0);
    expect(parsed.payload.memoryNodes).toHaveLength(0);
  });

  it('refuses an edge with no evidence refs rather than rendering a bare similarity link', () => {
    const parsed = parseConstellationPayload({
      ...CONSTELLATION_FULL_FIXTURE,
      edges: [{ source: 'r1', target: 'r2', reason: { type: 'citation', text: 'looks similar', evidenceRefs: [] } }],
    });
    expect(parsed.ok).toBe(false);
  });

  it('reports a reason instead of throwing on junk', () => {
    for (const junk of [null, 42, 'nope', [], {}, { nodes: [] }]) {
      const parsed = parseConstellationPayload(junk);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('capConstellationPayload', () => {
  it('holds the eight result node and two memory node caps', () => {
    const capped = capConstellationPayload(CONSTELLATION_OVERSIZED_FIXTURE);
    expect(capped.nodes).toHaveLength(MAX_CONSTELLATION_RESULT_NODES);
    expect(capped.memoryNodes).toHaveLength(MAX_CONSTELLATION_MEMORY_NODES);
  });

  it('keeps the lowest admitted ranks when it trims', () => {
    const capped = capConstellationPayload(CONSTELLATION_OVERSIZED_FIXTURE);
    expect(capped.nodes.map((node) => node.admittedRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('drops every edge that pointed at a trimmed node', () => {
    const capped = capConstellationPayload(CONSTELLATION_OVERSIZED_FIXTURE);
    const ids = new Set([...capped.nodes.map((n) => n.id), ...capped.memoryNodes.map((n) => n.id)]);
    for (const edge of capped.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
    }
    expect(capped.edges.some((edge) => edge.source === 'r9' || edge.source === 'm3')).toBe(false);
  });

  it('caps through the parse entry point as well', () => {
    const parsed = parseConstellationPayload(CONSTELLATION_OVERSIZED_FIXTURE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.payload.nodes).toHaveLength(MAX_CONSTELLATION_RESULT_NODES);
    expect(parsed.payload.memoryNodes).toHaveLength(MAX_CONSTELLATION_MEMORY_NODES);
  });
});

describe('readConstellationState', () => {
  it('reads the state the scene package carries under provenance.constellation', () => {
    const state = readConstellationState(CONSTELLATION_SCENE_PACKAGE_FIXTURE);
    expect(state.kind).toBe('success');
  });

  it('degrades to the error state instead of throwing when the payload is absent', () => {
    const bare: ScenePackageV2 = { ...CONSTELLATION_SCENE_PACKAGE_FIXTURE, provenance: {} };
    const state = readConstellationState(bare);
    expect(state.kind).toBe('error');
    if (state.kind !== 'error') return;
    expect(state.cause).toContain('no constellation payload');
  });

  it('degrades to the error state instead of throwing when the payload is malformed', () => {
    const broken: ScenePackageV2 = {
      ...CONSTELLATION_SCENE_PACKAGE_FIXTURE,
      provenance: { constellation: { kind: 'success', payload: { nodes: 'not an array' } } },
    };
    const state = readConstellationState(broken);
    expect(state.kind).toBe('error');
  });

  it('treats a bare payload as the success state', () => {
    const bare: ScenePackageV2 = {
      ...CONSTELLATION_SCENE_PACKAGE_FIXTURE,
      provenance: { constellation: CONSTELLATION_NO_MEMORY_FIXTURE },
    };
    const state = readConstellationState(bare);
    expect(state.kind).toBe('success');
    if (state.kind !== 'success') return;
    expect(state.payload.memoryNodes).toHaveLength(0);
  });
});

describe('parseConstellationState', () => {
  it('round trips every D5 fixture', () => {
    for (const [kind, fixture] of Object.entries(CONSTELLATION_STATE_FIXTURES)) {
      expect(parseConstellationState(fixture).kind).toBe(kind);
    }
  });
});

describe('constellationDegradedNotes', () => {
  it('surfaces the partial state notes and the degraded providers from meta', () => {
    const notes = constellationDegradedNotes(CONSTELLATION_STATE_FIXTURES.partial);
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(notes.join(' ')).toContain('brave');
    expect(notes.join(' ')).toContain('crossref');
  });

  it('says nothing when nothing degraded', () => {
    expect(constellationDegradedNotes(CONSTELLATION_STATE_FIXTURES.success)).toHaveLength(0);
  });
});
