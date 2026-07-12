import { describe, expect, it } from 'vitest';
import {
  assertInventoryClean,
  lintNarration,
  narrationFor,
  WAIT_NARRATION_INVENTORY,
} from './commonplace-wait-narration';

// WL-2 acceptance (HANDOFF-WAIT-LADDER D2): every inventory string passes the
// conservative voice lint, and narrationFor clamps out-of-range step indices
// to the last available step rather than looping or going blank.
describe('assertInventoryClean', () => {
  it('finds no violations in the shipped inventory', () => {
    expect(assertInventoryClean()).toEqual([]);
  });
});

describe('lintNarration', () => {
  it('rejects exclamation points', () => {
    expect(lintNarration('Searching the web!')).toContain(
      'exclamation point reads as false enthusiasm for a wait state',
    );
  });

  it('rejects a trailing ellipsis', () => {
    expect(lintNarration('Searching the web...')).toContain(
      'trailing ellipsis simulates activity instead of naming the step',
    );
    expect(lintNarration('Searching the web…')).toContain(
      'trailing ellipsis simulates activity instead of naming the step',
    );
  });

  it('rejects filler openers', () => {
    expect(lintNarration('Just a moment')).toContain('filler opener adds no concrete intent');
    expect(lintNarration('Please wait for results')).toContain(
      'filler opener adds no concrete intent',
    );
  });

  it('rejects strings over the length ceiling', () => {
    const tooLong = 'Searching every corner of your library and the wider web';
    expect(lintNarration(tooLong).some((v) => v.startsWith('line exceeds'))).toBe(true);
  });

  it('accepts a clean line', () => {
    expect(lintNarration('Searching the web')).toEqual([]);
  });
});

describe('narrationFor', () => {
  it('returns the step at a valid index', () => {
    expect(narrationFor('searching', 0)).toBe(WAIT_NARRATION_INVENTORY.searching[0]);
    expect(narrationFor('searching', 1)).toBe(WAIT_NARRATION_INVENTORY.searching[1]);
  });

  it('clamps an index beyond the last step to the last step', () => {
    const steps = WAIT_NARRATION_INVENTORY.capturing;
    expect(narrationFor('capturing', steps.length)).toBe(steps[steps.length - 1]);
    expect(narrationFor('capturing', 999)).toBe(steps[steps.length - 1]);
  });

  it('clamps a negative index to the first step', () => {
    const steps = WAIT_NARRATION_INVENTORY.thinking;
    expect(narrationFor('thinking', -5)).toBe(steps[0]);
  });

  it('clamps a non-finite index to the first step', () => {
    const steps = WAIT_NARRATION_INVENTORY.syncing;
    expect(narrationFor('syncing', Number.NaN)).toBe(steps[0]);
  });

  it('holds on the final line for a long-running op rather than looping', () => {
    const steps = WAIT_NARRATION_INVENTORY.agentRun;
    const late = narrationFor('agentRun', steps.length + 10);
    expect(late).toBe(steps[steps.length - 1]);
    expect(late).not.toBe(steps[0]);
  });
});
