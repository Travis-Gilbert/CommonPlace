/**
 * Seed the research surface from a carried bundle (HANDOFF-CARRY D4).
 *
 * Carry to Research derives a new query from the bundle's top entity intersects
 * and open margin questions, and seeds the compose/search surface with it. The
 * dedicated search-constellation surface (HANDOFF-SEARCH-CONSTELLATION) is not
 * built in this checkout, so per the plan's forced dependency (FD-C1) we seed
 * the existing compose query surface; the derived query is observably a function
 * of the bundle's entities and questions (C4.1).
 */

import type { CitedPacket } from './compile';

/** Collect entity mentions across the bundle, most frequent first. */
function topEntities(packet: CitedPacket, limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const record of packet.records) {
    const entities = record.metadata.entities;
    if (Array.isArray(entities)) {
      for (const entity of entities) {
        const key = String(entity).trim();
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([entity]) => entity);
}

/** Open questions from margin threads (messages that ask something). */
function openQuestions(packet: CitedPacket, limit = 3): string[] {
  const questions: string[] = [];
  for (const record of packet.records) {
    if (record.kind !== 'margin_thread') continue;
    const thread = record.metadata.thread as { text: string }[] | undefined;
    for (const message of thread ?? []) {
      const text = message.text.trim();
      if (text.endsWith('?')) questions.push(text);
    }
  }
  return questions.slice(0, limit);
}

/**
 * The seeded research query: top entity intersects joined, followed by the open
 * margin questions. Deterministic and observably derived from the bundle.
 */
export function deriveResearchQuery(packet: CitedPacket): string {
  const entities = topEntities(packet);
  const questions = openQuestions(packet);
  const parts: string[] = [];
  if (entities.length > 0) parts.push(entities.join(' '));
  if (questions.length > 0) parts.push(questions.join(' '));
  if (parts.length === 0) {
    // No entities or questions surfaced: fall back to the carried source titles.
    const titles = packet.records
      .map((r) => (r.metadata.sourceTitle as string | undefined) ?? '')
      .filter(Boolean)
      .slice(0, 4);
    return titles.join(' ');
  }
  return parts.join(' — ');
}
