/**
 * Seed the build surface from a carried bundle (HANDOFF-CARRY D3).
 *
 * Carry to Build lists the carried sources in a bundle rail and loads them into
 * the coding agent's context, so the agent can answer from a carried source on
 * its first turn (C3.3). Inserting a rail item drops a cited reference into the
 * composer (C3.2). Nothing is generated on carry (C3.4): these are pure string
 * builders; the user still sends the first turn.
 */

import type { CitedPacket, CitedRecord } from './compile';

/** One cited reference line for a single carried source, safe to insert into a
 *  comment or the agent composer (C3.2). */
export function citedReference(record: CitedRecord): string {
  const title = (record.metadata.sourceTitle as string | undefined) ?? String(record.metadata.sourceUrl ?? 'source');
  const url = String(record.metadata.sourceUrl ?? '');
  const quote = record.content.trim();
  const source = url ? `${title} (${url})` : title;
  return quote ? `> ${quote}\n> — ${source}` : `— ${source}`;
}

/**
 * The cited-context prelude loaded into the coding agent's context (C3.3). A
 * compact, cited digest of the carried sources the agent can ground its first
 * answer in. Marked as carried context so it is never mistaken for a user
 * instruction.
 */
export function buildContextPrelude(packet: CitedPacket): string {
  if (packet.records.length === 0) return '';
  const lines = packet.records.map((record, index) => {
    const title = (record.metadata.sourceTitle as string | undefined) ?? `source ${index + 1}`;
    const url = String(record.metadata.sourceUrl ?? '');
    const quote = record.content.trim().replace(/\s+/g, ' ');
    const clipped = quote.length > 240 ? `${quote.slice(0, 240)}...` : quote;
    const explanation = record.metadata.connectionExplanation as string | undefined;
    const because = explanation ? ` [${explanation}]` : '';
    return `${index + 1}. ${title}${url ? ` (${url})` : ''}: "${clipped}"${because}`;
  });
  return [
    `Carried context (${packet.records.length} cited ${packet.records.length === 1 ? 'source' : 'sources'} from a browsing session):`,
    ...lines,
    '',
    'Use these sources when relevant; each is anchored to its origin.',
  ].join('\n');
}
