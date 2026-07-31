import { describe, expect, it } from 'vitest';
import { PROGRAM_CONTRACTS_SOURCE } from '@commonplace/program-contracts';

describe('@commonplace/program-contracts', () => {
  it('exports the programmable graph contract boundary', () => {
    expect(PROGRAM_CONTRACTS_SOURCE.crate).toBe('rustyred-thg-programmable-graph');
  });
});
