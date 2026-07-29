'use client';

// SOURCING: eventsource-parser (console SSE consumption ledger row).

import { createParser, type EventSourceMessage } from 'eventsource-parser';

export interface AgentSpaceEnvelope {
  readonly seq: number;
  readonly tenant_slug: string;
  readonly room_id?: string;
  readonly event: {
    readonly type: string;
    readonly data: unknown;
  };
}

interface AgentSpaceSnapshot {
  readonly epoch: string;
  readonly seq: number;
}

export interface SubscribeRoomEventsOptions {
  readonly roomId: string;
  readonly onEnvelope: (envelope: AgentSpaceEnvelope) => void;
  readonly onError: (error: Error) => void;
  readonly signal?: AbortSignal;
}

type StreamOutcome = 'closed' | 'resnapshot';

function eventUrl(path: string, params: Record<string, string>): string {
  return `/api/events/${path}?${new URLSearchParams(params).toString()}`;
}

function asNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function snapshotFrom(value: unknown): AgentSpaceSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as { epoch?: unknown; seq?: unknown };
  const seq = asNonNegativeInteger(snapshot.seq);
  if (seq === null || (typeof snapshot.epoch !== 'number' && typeof snapshot.epoch !== 'string')) {
    return null;
  }
  return { seq, epoch: String(snapshot.epoch) };
}

function epochFromSnapshotJson(raw: string): string | null {
  const match = /"epoch"\s*:\s*(?:"([^"]+)"|(\d+))/.exec(raw);
  return match?.[1] ?? match?.[2] ?? null;
}

function envelopeFrom(value: unknown): AgentSpaceEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as {
    seq?: unknown;
    tenant_slug?: unknown;
    room_id?: unknown;
    event?: { type?: unknown; data?: unknown };
  };
  const seq = asNonNegativeInteger(envelope.seq);
  if (
    seq === null
    || typeof envelope.tenant_slug !== 'string'
    || (envelope.room_id !== undefined && typeof envelope.room_id !== 'string')
    || !envelope.event
    || typeof envelope.event.type !== 'string'
  ) {
    return null;
  }
  return {
    seq,
    tenant_slug: envelope.tenant_slug,
    ...(envelope.room_id === undefined ? {} : { room_id: envelope.room_id }),
    event: { type: envelope.event.type, data: envelope.event.data },
  };
}

function errorCondition(data: string): string | null {
  try {
    const body = JSON.parse(data) as { condition?: unknown };
    return typeof body.condition === 'string' ? body.condition : null;
  } catch {
    return null;
  }
}

async function fetchSnapshot(roomId: string, signal: AbortSignal): Promise<AgentSpaceSnapshot> {
  const response = await fetch(eventUrl('snapshot', { room: roomId }), {
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error(`event_snapshot_failed:${response.status}`);
  const raw = await response.text();
  try {
    const snapshot = snapshotFrom(JSON.parse(raw));
    const epoch = epochFromSnapshotJson(raw);
    if (!snapshot || !epoch) throw new Error('event_snapshot_invalid');
    return { ...snapshot, epoch };
  } catch {
    throw new Error('event_snapshot_invalid');
  }
}

async function consumeStream(
  roomId: string,
  snapshot: AgentSpaceSnapshot,
  options: SubscribeRoomEventsOptions,
  signal: AbortSignal,
): Promise<StreamOutcome> {
  const response = await fetch(eventUrl('stream', {
    room: roomId,
    cursor: String(snapshot.seq),
    epoch: snapshot.epoch,
  }), {
    headers: { Accept: 'text/event-stream' },
    cache: 'no-store',
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`event_stream_failed:${response.status}`);

  let cursor = snapshot.seq;
  let resnapshot = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const requestSnapshot = () => {
    resnapshot = true;
    void reader?.cancel();
  };
  const parser = createParser({
    onComment(comment) {
      const normalized = comment.trim();
      const epoch = normalized.startsWith('epoch:') ? normalized.slice('epoch:'.length).trim() : null;
      if (epoch && epoch !== snapshot.epoch) requestSnapshot();
    },
    onEvent(event: EventSourceMessage) {
      if (event.event === 'error') {
        const condition = errorCondition(event.data);
        if (condition === 'event_epoch_mismatch' || condition === 'event_stream_lagged') {
          requestSnapshot();
          return;
        }
        options.onError(new Error(condition ?? 'event_stream_error'));
        return;
      }
      try {
        const envelope = envelopeFrom(JSON.parse(event.data));
        if (!envelope) {
          options.onError(new Error('event_envelope_invalid'));
          return;
        }
        if (envelope.seq <= cursor) return;
        cursor = envelope.seq;
        options.onEnvelope(envelope);
      } catch {
        options.onError(new Error('event_envelope_invalid'));
      }
    },
  });

  reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    if (resnapshot) return 'resnapshot';
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
  parser.feed(decoder.decode());
  return resnapshot ? 'resnapshot' : 'closed';
}

export function subscribeRoomEvents({
  roomId,
  onEnvelope,
  onError,
  signal,
}: SubscribeRoomEventsOptions): () => void {
  const controller = new AbortController();
  let active = true;
  const stop = () => {
    active = false;
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) stop();
    else signal.addEventListener('abort', stop, { once: true });
  }

  void (async () => {
    while (active) {
      try {
        const snapshot = await fetchSnapshot(roomId, controller.signal);
        const outcome = await consumeStream(
          roomId,
          snapshot,
          { roomId, onEnvelope, onError, signal },
          controller.signal,
        );
        if (outcome === 'closed') return;
      } catch (error) {
        if (controller.signal.aborted || !active) return;
        onError(error instanceof Error ? error : new Error('event_subscription_failed'));
        return;
      }
    }
  })();

  return () => {
    if (signal) signal.removeEventListener('abort', stop);
    stop();
  };
}
