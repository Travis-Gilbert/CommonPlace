import { fieldOrganContracts } from '@commonplace/block-view';
import { describe, expect, it } from 'vitest';

describe('field-organ descriptor contracts', () => {
  it('keeps the four shared renderer identities platform-neutral', () => {
    expect(Object.values(fieldOrganContracts).map((contract) => contract.id)).toEqual([
      'card.compact',
      'chat.thread',
      'markdown.doc',
      'agency.proposal',
    ]);
    expect(Object.values(fieldOrganContracts).every((contract) => !('render' in contract))).toBe(true);
  });
});
