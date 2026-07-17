import { describe, expect, it } from 'vitest';
import { connectionProvenance } from '../provenance';
import type { MarginCandidate } from '../overlay-model';

function candidate(over: Partial<MarginCandidate> = {}): MarginCandidate {
  return {
    id: 'item:war:40-61',
    quote: { exact: 'the Peloponnesian War' },
    tier: 'exact',
    score: 1,
    explanation: 'This passage names "Peloponnesian War", which is already in your library.',
    refs: ['item:war'],
    ...over,
  };
}

describe('connectionProvenance (D6-2)', () => {
  it('projects what, why, and how an exact connection was drawn', () => {
    const provenance = connectionProvenance(candidate());
    expect(provenance.why).toContain('Peloponnesian War');
    expect(provenance.tier).toBe('exact');
    expect(provenance.basis).toBe('This page names a record in your library.');
    expect(provenance.records).toEqual(['item:war']);
    expect(provenance.hasChain).toBe(true);
  });

  it('reads the semantic evidence path for a semantic connection', () => {
    const provenance = connectionProvenance(
      candidate({ tier: 'semantic', refs: ['item:art', 'item:notes'] }),
    );
    expect(provenance.basis).toBe('This passage reads close to a saved note.');
    // Openable chain keeps the pipeline's strongest-first order.
    expect(provenance.records).toEqual(['item:art', 'item:notes']);
    expect(provenance.hasChain).toBe(true);
  });

  it('reports no chain when the candidate links no records (honest empty state)', () => {
    expect(connectionProvenance(candidate({ refs: [] })).hasChain).toBe(false);
    expect(connectionProvenance(candidate({ refs: undefined })).records).toEqual([]);
    expect(connectionProvenance(candidate({ refs: undefined })).hasChain).toBe(false);
  });
});
