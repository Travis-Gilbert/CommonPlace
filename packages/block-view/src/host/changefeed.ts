// SOURCING: none. Pure logic, no upstream component applies.
'use client';

/**
 * Shared SSE client for THEOREM_PROACTIVITY_CHANGEFEED_URL (RustyRed
 * `/v1/proactivity/stream`). One connection fans out invalidations to every
 * live ObjectQuery subscription; subscribers re-query authoritatively rather
 * than patching rows in place.
 *
 * When the stream is down, degradation is silent for block bodies: callers
 * re-query on window focus and expose connection status through onStatus.
 */

import type { ObjectQuery, TypeRef, Unsubscribe } from '../types';

export type ChangefeedConnectionStatus = 'connecting' | 'live' | 'stale';

/** Parsed changefeed payload used for fan-out filtering. */
export interface ChangefeedEventPayload {
  readonly type?: string;
  readonly types?: readonly string[];
  readonly id?: string;
  readonly object_id?: string;
  readonly object_type?: string;
}

export interface ChangefeedClientOptions {
  /** Deploy value of THEOREM_PROACTIVITY_CHANGEFEED_URL. Absent disables SSE. */
  readonly url?: string;
  readonly onStatus?: (status: ChangefeedConnectionStatus) => void;
  readonly EventSourceImpl?: typeof EventSource;
}

interface LiveSubscription {
  readonly query: ObjectQuery;
  readonly invalidate: () => void;
}

type EventSourceLike = {
  close(): void;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  onerror: ((event: Event) => void) | null;
  onopen: ((event: Event) => void) | null;
};

const INVALIDATION_EVENTS = [
  'object.changed',
  'object.upserted',
  'object.deleted',
  'object.created',
  'proactivity.firing',
  'message',
] as const;

export function eventMatchesQuery(
  payload: ChangefeedEventPayload,
  query: ObjectQuery,
): boolean {
  const queryTypes = query.types;
  if (queryTypes.length === 0) return true;

  const eventTypes: string[] = [];
  if (payload.type) eventTypes.push(payload.type);
  if (payload.object_type) eventTypes.push(payload.object_type);
  if (payload.types) eventTypes.push(...payload.types);
  if (eventTypes.length === 0) return true;

  return eventTypes.some((type) => queryTypes.includes(type as TypeRef));
}

function parsePayload(raw: string): ChangefeedEventPayload | null {
  try {
    return JSON.parse(raw) as ChangefeedEventPayload;
  } catch {
    return null;
  }
}

export class ChangefeedClient {
  private readonly subscriptions = new Set<LiveSubscription>();
  private source: EventSourceLike | null = null;
  private status: ChangefeedConnectionStatus = 'stale';
  private focusListener: (() => void) | null = null;

  constructor(private readonly options: ChangefeedClientOptions) {}

  get connectionStatus(): ChangefeedConnectionStatus {
    return this.status;
  }

  subscribe(query: ObjectQuery, invalidate: () => void): Unsubscribe {
    const entry: LiveSubscription = { query, invalidate };
    this.subscriptions.add(entry);
    this.ensureFocusFallback();
    this.ensureStream();
    if (this.status === 'stale') this.options.onStatus?.('stale');
    return () => {
      this.subscriptions.delete(entry);
      if (this.subscriptions.size === 0) this.teardown();
    };
  }

  /** Test hook: fan-out a synthetic invalidation without a backend stream. */
  emitTestEvent(payload: ChangefeedEventPayload = {}): void {
    this.dispatch(payload);
  }

  destroy(): void {
    this.teardown();
    this.subscriptions.clear();
  }

  private setStatus(next: ChangefeedConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.options.onStatus?.(next);
  }

  private ensureStream(): void {
    const url = this.options.url?.trim();
    if (!url || this.source) return;
    const EventSourceCtor = this.options.EventSourceImpl ?? globalThis.EventSource;
    if (typeof EventSourceCtor !== 'function') {
      this.setStatus('stale');
      return;
    }

    this.setStatus('connecting');
    const source = new EventSourceCtor(url) as EventSourceLike;
    this.source = source;

    source.onopen = () => this.setStatus('live');

    const handleMessage = (event: MessageEvent<string>) => {
      const payload = parsePayload(event.data) ?? {};
      this.dispatch(payload);
    };

    for (const name of INVALIDATION_EVENTS) {
      source.addEventListener(name, handleMessage);
    }

    source.onerror = () => {
      this.setStatus('stale');
      source.close();
      this.source = null;
    };
  }

  private ensureFocusFallback(): void {
    if (this.focusListener || typeof window === 'undefined') return;
    this.focusListener = () => {
      if (this.status === 'live') return;
      for (const subscription of this.subscriptions) subscription.invalidate();
    };
    window.addEventListener('focus', this.focusListener);
  }

  private dispatch(payload: ChangefeedEventPayload): void {
    for (const subscription of this.subscriptions) {
      if (eventMatchesQuery(payload, subscription.query)) {
        subscription.invalidate();
      }
    }
  }

  private teardown(): void {
    this.source?.close();
    this.source = null;
    if (this.focusListener && typeof window !== 'undefined') {
      window.removeEventListener('focus', this.focusListener);
      this.focusListener = null;
    }
    this.setStatus('stale');
  }
}

const sharedClients = new Map<string, ChangefeedClient>();

export function resolveChangefeedClient(options: ChangefeedClientOptions): ChangefeedClient {
  const key = options.url?.trim() ?? '';
  let client = sharedClients.get(key);
  if (!client) {
    client = new ChangefeedClient(options);
    sharedClients.set(key, client);
  }
  return client;
}

/** Vitest-only reset so tests do not leak singleton state. */
export function resetChangefeedClientsForTests(): void {
  for (const client of sharedClients.values()) client.destroy();
  sharedClients.clear();
}
