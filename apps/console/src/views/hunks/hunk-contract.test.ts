import { describe, expect, it } from 'vitest';
import type { ObjectRef } from '@commonplace/block-view/types';
import { HUNK_SOURCES, hunkFromObject } from './hunk-contract';

function fixture(source: (typeof HUNK_SOURCES)[number], index: number): ObjectRef {
  return {
    id: `hunk-${index}`,
    type: 'hunk',
    properties: {
      hunk_id: `${source}:${index}`,
      source: ({ AgentRun: 'agent_run', Briefing: 'briefing', Recalc: 'recalc', AppInstall: 'app_install', SchemaDraft: 'schema_draft' } as const)[source],
      state: source === 'AgentRun' ? { kind: 'applied', branch_ref: { name: 'run', commit_hash: 'abc', tree_hash: 'tree' } } : { kind: 'proposed', actions: [] },
      target_block: `block:${index}`,
      after_ref: `value:${index}:after`,
      derivation_refs: [`derivation:${index}`],
      discharge: source === 'SchemaDraft' ? { kind: 'discharged', verify_ref: 'verify:1' } : { kind: 'deterministic' },
      group_id: `group:${source}`,
      capability_class: `${source}.write`,
      semiring: { supported: true, independent_lines: 1, weakest_link: '0.9', confidence: 0.9 },
      change: { object_key: `${source} change`, object_kind: 'node', change_kind: 'modified' },
    },
  };
}

describe('typed Hunk object adapter', () => {
  it('renders all five Rust-owned sources through one wire contract', () => {
    const hunks = HUNK_SOURCES.map((source, index) => hunkFromObject(fixture(source, index)));
    expect(hunks.map((hunk) => hunk?.source)).toEqual(HUNK_SOURCES);
    expect(hunks[0]?.state).toBe('applied');
    expect(hunks[4]?.discharge).toBe('discharged');
  });

  it('classifies missing model-authored stochastic metadata as undischarged', () => {
    const object = fixture('Recalc', 1);
    const hunk = hunkFromObject({
      ...object,
      properties: { ...object.properties, discharge: null, model_authored: true },
    });
    expect(hunk?.discharge).toBe('undischarged');
  });

  it('rejects malformed objects instead of inventing a review value', () => {
    expect(hunkFromObject({ id: 'not-a-hunk', type: 'record', properties: {} })).toBeNull();
    expect(hunkFromObject({ id: 'missing-after', type: 'hunk', properties: { source: 'AgentRun' } })).toBeNull();
  });

  it('keeps structured values on the registered descriptor path', () => {
    const object = fixture('AgentRun', 2);
    const hunk = hunkFromObject({
      ...object,
      properties: {
        ...object.properties,
        after_view: { descriptor_id: 'markdown.doc', query: { types: ['doc'] } },
      },
    });
    expect(hunk?.afterStructured).toEqual({ descriptorId: 'markdown.doc', query: { types: ['doc'] } });
  });
});
