import { describe, expect, it } from 'vitest';
import { hunkExecutorAction } from './hunk-actions';
import type { HunkViewModel } from './hunk-contract';

function fixture(id: string): HunkViewModel {
  return {
    hunkId: id,
    source: 'Briefing',
    state: 'proposed',
    targetBlock: `block:${id}`,
    afterRef: `value:${id}`,
    derivationRefs: [],
    discharge: 'deterministic',
    groupId: 'briefing:today',
    capabilityClass: 'briefing.publish',
    semiring: { supported: false, independentLines: 0 },
  };
}

describe('named Hunk executor actions', () => {
  it('represents a grouped accept as one host action carrying every hunk id', () => {
    const action = hunkExecutorAction('accept', [fixture('one'), fixture('two'), fixture('three')]);
    expect(action).toEqual({
      kind: 'invoke_tool',
      tool: 'hunk.accept',
      args: {
        hunk_ids: ['one', 'two', 'three'],
        group_id: 'briefing:today',
        target_blocks: ['block:one', 'block:two', 'block:three'],
        human_discharge: false,
      },
    });
  });

  it('marks sovereign acceptance as an explicit human discharge', () => {
    const action = hunkExecutorAction('accept', [fixture('one')], { humanDischarge: true });
    expect(action.kind).toBe('invoke_tool');
    if (action.kind === 'invoke_tool') expect(action.args.human_discharge).toBe(true);
  });
});
