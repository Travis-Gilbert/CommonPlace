import { describe, expect, it } from 'vitest';

import {
  appendEvent,
  clearBundle,
  getBundle,
  getCount,
  getItems,
  linkAncestor,
} from '../bundle-store';
import { bundleToRecords, compileBundle, type CitedPacket } from '../compile';

// HANDOFF-CARRY D1 acceptance. Runs against the in-memory store path (no
// IndexedDB in node): the same real bundle logic, just not durable.

/** Drive the spec's scripted session: 2 highlights, 1 Keep, 1 margin thread. */
async function scriptSession(sessionId: string) {
  await appendEvent(sessionId, {
    kind: 'highlight',
    anchor: { url: 'https://a.example/one', title: 'One', quote: 'first highlight' },
    connectionExplanation: 'echoes the thesis',
    at: 1,
  });
  await appendEvent(sessionId, {
    kind: 'highlight',
    anchor: { url: 'https://a.example/two', title: 'Two', quote: 'second highlight' },
    at: 2,
  });
  await appendEvent(sessionId, {
    kind: 'keep',
    anchor: { url: 'https://b.example', title: 'Kept', quote: 'a kept passage', fragment: ':~:text=a%20kept' },
    receiptIds: ['rcpt-1'],
    at: 3,
  });
  await appendEvent(sessionId, {
    kind: 'margin_thread',
    anchor: { url: 'https://c.example', title: 'Margin' },
    thread: [
      { author: 'me', text: 'why does this hold?', at: 4 },
      { author: 'me', text: 'because of X', at: 5 },
    ],
    at: 6,
  });
}

describe('bundle store (C1.1)', () => {
  it('accumulates exactly the scripted items with full provenance', async () => {
    const sessionId = 'sess-script-1';
    await clearBundle(sessionId);
    await scriptSession(sessionId);

    const items = await getItems(sessionId);
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.kind)).toEqual(['highlight', 'highlight', 'keep', 'margin_thread']);

    // Full provenance: source url, capture time, connection explanation, receipts.
    expect(items[0].anchor.url).toBe('https://a.example/one');
    expect(items[0].connectionExplanation).toBe('echoes the thesis');
    expect(items[2].anchor.fragment).toBe(':~:text=a%20kept');
    expect(items[2].receiptIds).toEqual(['rcpt-1']);
    expect(items[3].thread).toHaveLength(2);
    // Every item is anchored to a source; nothing is bare text.
    expect(items.every((i) => typeof i.anchor.url === 'string' && i.anchor.url.length > 0)).toBe(true);
  });

  it('an empty session has no bundle and a zero count (affordance stays quiet, C1.3)', async () => {
    const sessionId = 'sess-empty-1';
    await clearBundle(sessionId);
    expect(await getBundle(sessionId)).toBeUndefined();
    expect(await getCount(sessionId)).toBe(0);
  });

  it('a non-empty session reports its count (affordance shows it, C1.3)', async () => {
    const sessionId = 'sess-count-1';
    await clearBundle(sessionId);
    await scriptSession(sessionId);
    expect(await getCount(sessionId)).toBe(4);
  });

  it('links an ancestor bundle for research lineage (C4.2)', async () => {
    const child = 'sess-child-1';
    await clearBundle(child);
    await linkAncestor(child, 'sess-parent-1');
    const bundle = await getBundle(child);
    expect(bundle?.parentSessionId).toBe('sess-parent-1');
  });
});

describe('compile (C1.2)', () => {
  it('round-trips the scripted items with metadata intact (pure mapping)', async () => {
    const sessionId = 'sess-compile-1';
    await clearBundle(sessionId);
    await scriptSession(sessionId);
    const bundle = await getBundle(sessionId);
    const records = bundleToRecords(bundle!.items);

    expect(records).toHaveLength(4);
    // Content is derived per kind, and metadata carries the provenance.
    expect(records[0].content).toBe('first highlight');
    expect(records[0].metadata.sourceUrl).toBe('https://a.example/one');
    expect(records[0].metadata.connectionExplanation).toBe('echoes the thesis');
    expect(records[2].metadata.receiptIds).toEqual(['rcpt-1']);
    expect(records[3].content).toContain('why does this hold?');
    expect((records[3].metadata.thread as unknown[]).length).toBe(2);
  });

  it('compiles through the proxy and preserves records', async () => {
    const sessionId = 'sess-compile-2';
    await clearBundle(sessionId);
    await scriptSession(sessionId);
    const bundle = await getBundle(sessionId);

    const stubFetch = (async () =>
      new Response(JSON.stringify({ records: [], trace: [{ step: 'ok' }], degraded: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;

    const packet: CitedPacket = await compileBundle(bundle!, stubFetch);
    // The proxy returned no records, so our real records are preserved.
    expect(packet.records).toHaveLength(4);
    expect(packet.trace).toHaveLength(1);
    expect(packet.degraded).toBe(false);
  });

  it('falls back to a degraded local packet when the proxy fails', async () => {
    const sessionId = 'sess-compile-3';
    await clearBundle(sessionId);
    await scriptSession(sessionId);
    const bundle = await getBundle(sessionId);

    const failingFetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const packet = await compileBundle(bundle!, failingFetch);
    expect(packet.degraded).toBe(true);
    expect(packet.records).toHaveLength(4); // real records, honestly flagged
  });
});
