/**
 * WS3 pure, defensive JSON-shape readers for the bespoke tool-call views
 * (MemoryRecallToolUI, CoordinationPingToolUI, ObjectSetToolUI). Extracted
 * from those components so the "honest, never fabricated" narrowing logic
 * is unit-testable in plain node/vitest, without a jsdom/RTL dependency —
 * this repo deliberately has neither installed yet (see
 * src/components/theseus/lens/__tests__/LensView.mount.test.tsx's header
 * comment), so pure-logic extraction is the established pattern for
 * testing React-adjacent code here.
 */

import type { WorkToolPart } from './types';
import type { ObjectRef } from '@/lib/block-view/types';

export interface RecallProvenanceItem {
  readonly itemId: string;
  readonly title: string;
  readonly score: number;
}

export interface AskResultSummary {
  readonly answer: string;
  readonly answerKind: string;
  readonly provenance: readonly RecallProvenanceItem[];
}

/** Reads gqlAsk's real AskResultGql shape out of a JsonValue tool result, honestly. */
export function readAskResult(result: WorkToolPart['result']): AskResultSummary | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const record = result as Record<string, unknown>;
  if (typeof record.answer !== 'string' || typeof record.answerKind !== 'string') return null;

  const provenanceRaw = Array.isArray(record.provenance) ? record.provenance : [];
  const provenance = provenanceRaw
    .map((entry): RecallProvenanceItem | null => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const item = e.item && typeof e.item === 'object' ? (e.item as Record<string, unknown>) : null;
      const itemId = item && typeof item.id === 'string' ? item.id : null;
      if (!itemId) return null;
      const title = typeof item?.title === 'string' && item.title.trim() ? item.title : itemId;
      const score = typeof e.score === 'number' ? e.score : 0;
      return { itemId, title, score };
    })
    .filter((entry): entry is RecallProvenanceItem => entry !== null);

  return { answer: record.answer, answerKind: record.answerKind, provenance };
}

export interface RoomSummary {
  readonly feedCount: number;
  readonly participants: readonly string[];
  readonly intentCount: number;
}

/** Reads the real Tauri RoomContext shape out of a JsonValue tool result, honestly. */
export function readRoomContext(result: WorkToolPart['result']): RoomSummary | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const record = result as Record<string, unknown>;
  if (!Array.isArray(record.feed) || !Array.isArray(record.participants) || !Array.isArray(record.intents)) {
    return null;
  }
  const participants = record.participants
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const actor = (entry as Record<string, unknown>).actor;
      return typeof actor === 'string' ? actor : null;
    })
    .filter((actor): actor is string => actor !== null);
  return { feedCount: record.feed.length, participants, intentCount: record.intents.length };
}

/** Shared by both bespoke tool views: reads a runTool()-authored `{error: string}` failure result. */
export function readErrorResult(result: WorkToolPart['result']): string | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const record = result as Record<string, unknown>;
  return typeof record.error === 'string' ? record.error : null;
}

/** ObjectSetToolUI's fallback-list label: prefers a human title, falls back to the object id. */
export function objectLabel(object: ObjectRef): string {
  const value = object.properties.title ?? object.properties.name ?? object.properties.display_title;
  return typeof value === 'string' && value.trim() ? value : object.id;
}
