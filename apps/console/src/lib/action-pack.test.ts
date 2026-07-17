// K7 (HANDOFF-CARDS-ACTIONS-MENTIONS): the pack serialization contract test.
// The pack-equals-chips assertion is the named invariant test of the round:
// the submitted pack is exactly the visible chip set, originating object
// first, nothing added, nothing dropped.

import { describe, expect, it } from 'vitest';
import { buildActionPack, packEqualsChips } from './action-pack';
import { objectChip, type StagedContextChip } from './shell-store';

const ORIGIN = objectChip('rec-1', 'task', 'Send the report');
const MANUAL: StagedContextChip = {
  id: 'chip-manual-1',
  kind: 'selection',
  label: 'the failing paragraph',
  text: 'the failing paragraph',
  source: 'manual',
};
const AUTO: StagedContextChip = {
  id: 'chip-auto-rec-2',
  kind: 'object',
  label: 'Weekly compliance sync',
  objectId: 'rec-2',
  objectType: 'record',
  source: 'auto',
};

describe('the prepared pack', () => {
  it('serializes exactly the visible chips, origin first', () => {
    const pack = buildActionPack('send it', [MANUAL, ORIGIN, AUTO], 'for-me', 'keep-open');
    expect(pack.context).toHaveLength(3);
    expect(pack.context[0]).toMatchObject({ kind: 'object', object_id: 'rec-1' });
    expect(packEqualsChips(pack, [MANUAL, ORIGIN, AUTO])).toBe(true);
  });

  it('detects a pack that drifted from the chips', () => {
    const pack = buildActionPack('send it', [ORIGIN, AUTO], 'for-me', 'keep-open');
    expect(packEqualsChips(pack, [ORIGIN, AUTO, MANUAL])).toBe(false);
    expect(packEqualsChips(pack, [ORIGIN])).toBe(false);
  });

  it('a removed auto chip never reaches the pack', () => {
    const visible = [ORIGIN, MANUAL];
    const pack = buildActionPack('send it', visible, 'with-me', 'mark-handled');
    expect(pack.context.map((entry) => entry.label)).toEqual([
      'Send the report',
      'the failing paragraph',
    ]);
    expect(pack.destination).toBe('with-me');
    expect(pack.follow_up).toBe('mark-handled');
  });
});
