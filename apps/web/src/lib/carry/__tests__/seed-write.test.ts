import { describe, expect, it } from 'vitest';

import type { CitedPacket } from '../compile';
import { anchorUrl, seededWriteBody, seededWriteTitle } from '../seed-write';

// HANDOFF-CARRY D2 acceptance: the seeded document renders quotes with working
// anchor links (a text fragment reopens the source at the passage), carries
// margin thread history, and records the bundle id.

const packet: CitedPacket = {
  sessionId: 'sess-w1',
  degraded: false,
  trace: [],
  records: [
    {
      id: 'r1',
      kind: 'keep',
      content: 'a kept passage',
      metadata: {
        sourceUrl: 'https://example.com/a',
        sourceTitle: 'Source A',
        anchorQuote: 'a kept passage',
        connectionExplanation: 'supports the thesis',
      },
    },
    {
      id: 'r2',
      kind: 'margin_thread',
      content: 'me: why?\nme: because',
      metadata: {
        sourceUrl: 'https://example.com/b',
        sourceTitle: 'Source B',
        thread: [
          { author: 'me', text: 'why?' },
          { author: 'me', text: 'because' },
        ],
      },
    },
  ],
};

describe('seed-write (C2.1/C2.2/C2.4)', () => {
  it('builds a text-fragment anchor that reopens the source at the passage', () => {
    const href = anchorUrl(packet.records[0]);
    expect(href).toBe('https://example.com/a#:~:text=a%20kept%20passage');
  });

  it('renders each carried quote as a citation blockquote with its source link', () => {
    const body = seededWriteBody(packet);
    expect(body).toContain('> a kept passage');
    expect(body).toContain('[Source A](https://example.com/a#:~:text=a%20kept%20passage)');
    expect(body).toContain('supports the thesis');
  });

  it('carries the full margin thread history', () => {
    const body = seededWriteBody(packet);
    expect(body).toContain('**Margin thread** on [Source B](https://example.com/b');
    expect(body).toContain('**me:** why?');
    expect(body).toContain('**me:** because');
  });

  it('records the bundle id on the document (C2.4)', () => {
    const body = seededWriteBody(packet);
    expect(body).toContain('carry:bundle=sess-w1');
    expect(seededWriteTitle(packet)).toBe('Carried notes (2 sources)');
  });
});
