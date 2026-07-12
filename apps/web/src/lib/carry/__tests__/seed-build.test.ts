import { describe, expect, it } from 'vitest';

import type { CitedPacket } from '../compile';
import { buildContextPrelude, citedReference } from '../seed-build';

// HANDOFF-CARRY D3: the coding agent's cited context and per-item references.

const packet: CitedPacket = {
  sessionId: 'sess-b1',
  degraded: false,
  trace: [],
  records: [
    {
      id: 'r1',
      kind: 'keep',
      content: 'the relevant passage',
      metadata: {
        sourceUrl: 'https://example.com/x',
        sourceTitle: 'Doc X',
        connectionExplanation: 'defines the term',
      },
    },
  ],
};

describe('seed-build (C3.2/C3.3)', () => {
  it('builds a cited context prelude the agent can ground its first turn in', () => {
    const prelude = buildContextPrelude(packet);
    expect(prelude).toContain('Carried context (1 cited source');
    expect(prelude).toContain('Doc X (https://example.com/x)');
    expect(prelude).toContain('the relevant passage');
    expect(prelude).toContain('[defines the term]');
  });

  it('builds an insertable cited reference for one source', () => {
    const ref = citedReference(packet.records[0]);
    expect(ref).toContain('> the relevant passage');
    expect(ref).toContain('Doc X (https://example.com/x)');
  });

  it('returns an empty prelude for an empty packet (no generation, C3.4)', () => {
    expect(buildContextPrelude({ ...packet, records: [] })).toBe('');
  });
});
