import { describe, expect, it } from 'vitest';

import { isReversibleSwipe, type AgencyProposal } from './types';

const proposal = (reversibility: string) => ({ reversibility }) as AgencyProposal;

describe('proposal gesture safety', () => {
  it('admits swipe only for explicitly reversible effects', () => {
    expect(isReversibleSwipe(proposal('reversible'))).toBe(true);
    expect(isReversibleSwipe(proposal('reversible_effect'))).toBe(true);
    expect(isReversibleSwipe(proposal('visible_artifact'))).toBe(false);
    expect(isReversibleSwipe(proposal('irreversible'))).toBe(false);
  });
});
