/**
 * WS1 thread runtime types.
 *
 * A WorkMessage is the persisted, plain JSON shape stored inside a Yjs
 * Y.Array (commonplace-page:thread-{sessionId}, local IndexedDB only).
 * Each Theseus pipeline stage (see StageEvent in theseus-api.ts) becomes
 * a WorkToolPart on the assistant message, matching assistant-ui's
 * tool-call content part contract. No data here is invented; every field
 * traces back to a real askTheseusAsyncStream event.
 */

import type { JsonValue } from '@/lib/block-view/types';

export type WorkMessageRole = 'user' | 'assistant';
export type WorkToolPartStatus = 'running' | 'complete';

export interface WorkToolPart {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly args: Readonly<Record<string, JsonValue>>;
  readonly result?: JsonValue;
  readonly status: WorkToolPartStatus;
}

export interface WorkMessage {
  readonly id: string;
  readonly role: WorkMessageRole;
  readonly text: string;
  readonly toolParts: readonly WorkToolPart[];
  readonly createdAt: number;
  readonly isStreaming: boolean;
  readonly error?: string;
}
