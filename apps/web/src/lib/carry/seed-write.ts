/**
 * Seed the write surface from a carried bundle (HANDOFF-CARRY D2).
 *
 * Carry to Write opens a new page pre-seeded with the carried quotes as citation
 * blocks: each quote is a blockquote whose source link carries a text fragment
 * (`#:~:text=`), so clicking it reopens the source at the exact passage (C2.1,
 * "working anchor links"). Margin threads carry their full thread history as a
 * threaded citation (C2.2). The document records the bundle id in a machine
 * marker so the write surface can tie the page back to its session (C2.4).
 *
 * Nothing here generates prose: it only lays the cited sources into the page.
 */

import type { CitedPacket, CitedRecord } from './compile';

/** A text-fragment URL that reopens the source at the quoted passage. */
export function anchorUrl(record: CitedRecord): string {
  const url = String(record.metadata.sourceUrl ?? '');
  if (!url) return '';
  const fragment = record.metadata.anchorFragment as string | undefined;
  if (fragment) return url.includes('#') ? url : `${url}${fragment.startsWith('#') ? '' : '#'}${fragment}`;
  const quote = record.metadata.anchorQuote as string | undefined;
  if (quote) {
    // Browser text fragment: reopen the page scrolled to and highlighting the quote.
    const snippet = quote.length > 120 ? quote.slice(0, 120) : quote;
    return `${url}#:~:text=${encodeURIComponent(snippet)}`;
  }
  return url;
}

function sourceLabel(record: CitedRecord): string {
  return (record.metadata.sourceTitle as string | undefined) ?? String(record.metadata.sourceUrl ?? 'source');
}

/** One citation block in Markdown: a blockquote plus an anchored source line. */
function citationBlock(record: CitedRecord): string {
  const label = sourceLabel(record);
  const href = anchorUrl(record);
  const explanation = record.metadata.connectionExplanation as string | undefined;
  const sourceLine = href ? `[${label}](${href})` : label;
  const because = explanation ? ` — ${explanation}` : '';

  if (record.kind === 'margin_thread') {
    const thread = (record.metadata.thread as { author: string; text: string }[] | undefined) ?? [];
    const lines = thread.map((m) => `> - **${m.author}:** ${m.text}`).join('\n');
    return `> **Margin thread** on ${sourceLine}\n${lines || '> (no messages)'}`;
  }

  const quote = record.content.trim() || label;
  return `> ${quote.replace(/\n/g, '\n> ')}\n>\n> ${sourceLine}${because}`;
}

/**
 * Build the seeded page's Markdown body from a compiled packet. Starts with a
 * machine marker recording the bundle id (C2.4), then a citation block per
 * carried source.
 */
export function seededWriteBody(packet: CitedPacket): string {
  const marker = `<!-- carry:bundle=${packet.sessionId ?? 'unknown'} count=${packet.records.length} -->`;
  const heading = '## Carried sources';
  const blocks = packet.records.map(citationBlock).join('\n\n');
  const intro =
    packet.records.length > 0
      ? blocks
      : '_No sources carried._';
  return `${marker}\n\n${heading}\n\n${intro}\n`;
}

/** A page title derived from the carried session. */
export function seededWriteTitle(packet: CitedPacket): string {
  const n = packet.records.length;
  return `Carried notes (${n} ${n === 1 ? 'source' : 'sources'})`;
}
