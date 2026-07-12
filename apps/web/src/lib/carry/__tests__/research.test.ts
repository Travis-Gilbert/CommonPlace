import { describe, expect, it } from 'vitest';

import { clearBundle, getBundle, linkAncestor } from '../bundle-store';
import type { CitedPacket } from '../compile';
import { deriveResearchQuery } from '../seed-research';

// HANDOFF-CARRY D4 acceptance: the seeded query derives from bundle entities and
// questions (C4.1); the lineage is navigable both ways (C4.2).

describe('deriveResearchQuery (C4.1)', () => {
  it('derives the query from top entity intersects and open questions', () => {
    const packet: CitedPacket = {
      sessionId: 's',
      degraded: false,
      trace: [],
      records: [
        { id: '1', kind: 'entity_intersect', content: '', metadata: { entities: ['Kelp', 'Carbon'] } },
        { id: '2', kind: 'entity_intersect', content: '', metadata: { entities: ['Kelp'] } },
        {
          id: '3',
          kind: 'margin_thread',
          content: '',
          metadata: { thread: [{ text: 'Does kelp sequester carbon?' }] },
        },
      ],
    };
    const query = deriveResearchQuery(packet);
    // Kelp appears twice so it leads; the open question rides along.
    expect(query.startsWith('Kelp')).toBe(true);
    expect(query).toContain('Carbon');
    expect(query).toContain('Does kelp sequester carbon?');
  });

  it('falls back to source titles when no entities or questions surfaced', () => {
    const packet: CitedPacket = {
      sessionId: 's',
      degraded: false,
      trace: [],
      records: [{ id: '1', kind: 'keep', content: 'x', metadata: { sourceTitle: 'Only Title' } }],
    };
    expect(deriveResearchQuery(packet)).toBe('Only Title');
  });
});

describe('research lineage (C4.2/C4.3)', () => {
  it('links the ancestor both ways and gives the new session its own bundle', async () => {
    const parent = 'r-parent-1';
    const child = 'r-child-1';
    await clearBundle(parent);
    await clearBundle(child);

    await linkAncestor(child, parent);

    const childBundle = await getBundle(child);
    const parentBundle = await getBundle(parent);
    // Child points up to the ancestor (C4.2) and has its own (empty) bundle (C4.3).
    expect(childBundle?.parentSessionId).toBe(parent);
    expect(childBundle?.items).toEqual([]);
    // Parent points down to the descendant (C4.2, both directions).
    expect(parentBundle?.childSessionIds).toContain(child);
  });
});
