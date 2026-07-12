import { describe, expect, it } from 'vitest';

import { appendRailEntry, clearRail, getRailEntries } from '../session-rail';

// HANDOFF-CARRY C5 acceptance (rail store logic; the presentational rail is
// verified in the browser). Runs against the in-memory store path.

describe('session rail store (C5.1 / C5.3)', () => {
  it('renders pre-carry and post-carry entries in order', async () => {
    const sessionId = 'rail-order-1';
    await clearRail(sessionId);
    await appendRailEntry(sessionId, { kind: 'capture', summary: 'kept a passage', at: 1 });
    await appendRailEntry(sessionId, {
      kind: 'carry',
      summary: 'carried 3 into Write',
      at: 2,
      receipt: { bundleId: sessionId, destination: 'write', itemCount: 3 },
    });
    await appendRailEntry(sessionId, { kind: 'destination', summary: 'seeded document', at: 3 });

    const entries = await getRailEntries(sessionId);
    expect(entries.map((e) => e.kind)).toEqual(['capture', 'carry', 'destination']);
    // The carry entry expands to its manifest.
    expect((entries[1].receipt as { itemCount: number }).itemCount).toBe(3);
  });

  it('a second carry from the same session appends rather than forking', async () => {
    const sessionId = 'rail-append-1';
    await clearRail(sessionId);
    await appendRailEntry(sessionId, { kind: 'carry', summary: 'carried into Write', at: 1 });
    await appendRailEntry(sessionId, { kind: 'carry', summary: 'carried into Build', at: 2 });

    const entries = await getRailEntries(sessionId);
    // Same rail, two carry entries in order (not two separate rails).
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.kind === 'carry')).toBe(true);
    expect(entries[0].summary).toContain('Write');
    expect(entries[1].summary).toContain('Build');
  });

  it('a publish event lands on the same rail (P4.4)', async () => {
    const sessionId = 'rail-publish-1';
    await clearRail(sessionId);
    await appendRailEntry(sessionId, {
      kind: 'publish',
      summary: 'published a note',
      receipt: { url: '/p/abc123', visibility: 'UNLISTED' },
      at: 1,
    });
    const entries = await getRailEntries(sessionId);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('publish');
    expect((entries[0].receipt as { url: string }).url).toBe('/p/abc123');
  });
});
