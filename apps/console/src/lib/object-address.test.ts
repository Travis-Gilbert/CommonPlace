// SOURCING: vitest (the app's test runner) over
// @commonplace/block-view/addressing. DESIGN-THEOREM-URI section 3: the
// console's half of the contract is that an object addressed anywhere is
// addressed identically everywhere, so these assert the console bindings
// (chip, pack, staged thread ref) rather than re-testing the grammar, which
// the shared module owns.

import { describe, expect, it } from 'vitest';
import { parseTheoremUri, theoremUri } from '@commonplace/block-view/addressing';
import { addressOf, objectAddress } from './object-address';
import { buildActionPack, packEqualsChips } from './action-pack';
import { objectChip, useShellStore } from './shell-store';

const TENANT = useShellStore.getState().tenant;

describe('the console address binding', () => {
  it('addresses an object by its graph type, and round-trips', () => {
    const uri = objectAddress(TENANT, { id: 'person-ada', type: 'person' });
    expect(uri).toBe(`theorem://${TENANT}/person/person-ada`);
    const parsed = parseTheoremUri(uri);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.address).toMatchObject({ tenant: TENANT, kind: 'person', id: 'person-ada' });
    }
  });

  it('mints the same address from loose parts', () => {
    expect(addressOf(TENANT, 'task', 'rec-1')).toBe(
      objectAddress(TENANT, { id: 'rec-1', type: 'task' }),
    );
  });

  it('survives an id carrying scheme characters', () => {
    const uri = addressOf(TENANT, 'record', 'thg:node/7');
    const parsed = parseTheoremUri(uri);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.address.id).toBe('thg:node/7');
  });

  it('gives every object chip the tenant address from the store', () => {
    const chip = objectChip('rec-1', 'task', 'Send the report');
    expect(chip.address).toBe(theoremUri({ tenant: TENANT, kind: 'task', id: 'rec-1' }));
  });

  it('carries the address into the action pack without breaking the invariant', () => {
    const chip = objectChip('rec-1', 'task', 'Send the report');
    const pack = buildActionPack('send it', [chip], 'for-me', 'keep-open');
    expect(pack.context[0].address).toBe(chip.address);
    expect(packEqualsChips(pack, [chip])).toBe(true);
    // A pack whose address drifted from the visible chip is not the chip set.
    expect(
      packEqualsChips(
        { ...pack, context: [{ ...pack.context[0], address: addressOf(TENANT, 'task', 'rec-2') }] },
        [chip],
      ),
    ).toBe(false);
  });

  it('leaves a chip with no object unaddressed', () => {
    const pack = buildActionPack(
      'send it',
      [{ id: 'chip-manual-1', kind: 'selection', label: 'a paragraph', text: 'a paragraph', source: 'manual' }],
      'for-me',
      'keep-open',
    );
    expect(pack.context[0].address).toBeUndefined();
  });
});
