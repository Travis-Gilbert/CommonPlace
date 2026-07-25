// SOURCING: none. Pure logic, no upstream component applies.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChangefeedClient,
  eventMatchesQuery,
  resetChangefeedClientsForTests,
} from './changefeed';

afterEach(() => {
  resetChangefeedClientsForTests();
  vi.unstubAllGlobals();
});

describe('eventMatchesQuery', () => {
  it('matches when the query has no type filter', () => {
    expect(eventMatchesQuery({ object_type: 'task' }, { types: [] })).toBe(true);
  });

  it('matches overlapping types and ignores unrelated events', () => {
    expect(eventMatchesQuery({ object_type: 'record' }, { types: ['record'] })).toBe(true);
    expect(eventMatchesQuery({ object_type: 'person' }, { types: ['record'] })).toBe(false);
  });

  it('treats untyped invalidations as relevant to every typed query', () => {
    expect(eventMatchesQuery({}, { types: ['record'] })).toBe(true);
  });
});

describe('ChangefeedClient', () => {
  it('fans out invalidations to every matching live subscription', () => {
    const client = new ChangefeedClient({});
    const recordHits: string[] = [];
    const personHits: string[] = [];
    client.subscribe({ types: ['record'], live: true }, () => {
      recordHits.push('record');
    });
    client.subscribe({ types: ['person'], live: true }, () => {
      personHits.push('person');
    });
    client.emitTestEvent({ object_type: 'record' });
    expect(recordHits).toEqual(['record']);
    expect(personHits).toEqual([]);
  });

  it('reports stale status when EventSource is unavailable', () => {
    const statuses: string[] = [];
    const client = new ChangefeedClient({
      url: 'http://example.test/stream',
      onStatus: (status) => statuses.push(status),
    });
    client.subscribe({ types: ['record'], live: true }, () => {});
    expect(statuses).toEqual(['stale']);
  });

  it('re-queries on focus when the stream is stale', () => {
    const focusHandlers = new Map<string, () => void>();
    vi.stubGlobal('window', {
      addEventListener: (name: string, handler: () => void) => {
        focusHandlers.set(name, handler);
      },
      removeEventListener: (name: string) => {
        focusHandlers.delete(name);
      },
    });

    const statuses: string[] = [];
    let hits = 0;
    const client = new ChangefeedClient({
      url: 'http://example.test/stream',
      onStatus: (status) => statuses.push(status),
    });
    client.subscribe({ types: ['record'], live: true }, () => {
      hits += 1;
    });

    focusHandlers.get('focus')?.();
    expect(hits).toBe(1);
    expect(statuses).toContain('stale');
  });

  it('does not focus-requery while the stream is live', async () => {
    class LiveEventSource {
      public onopen: ((event: Event) => void) | null = null;
      public onerror: ((event: Event) => void) | null = null;
      private readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();

      constructor(_url: string) {
        queueMicrotask(() => this.onopen?.(new Event('open')));
      }

      addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
        const bucket = this.listeners.get(type) ?? new Set();
        bucket.add(listener);
        this.listeners.set(type, bucket);
      }

      close(): void {}
    }

    const focusHandlers = new Map<string, () => void>();
    vi.stubGlobal('window', {
      addEventListener: (name: string, handler: () => void) => {
        focusHandlers.set(name, handler);
      },
      removeEventListener: (name: string) => {
        focusHandlers.delete(name);
      },
    });

    let hits = 0;
    const client = new ChangefeedClient({
      url: 'http://example.test/stream',
      EventSourceImpl: LiveEventSource as unknown as typeof EventSource,
    });
    client.subscribe({ types: ['record'], live: true }, () => {
      hits += 1;
    });
    await Promise.resolve();
    expect(client.connectionStatus).toBe('live');

    focusHandlers.get('focus')?.();
    expect(hits).toBe(0);
  });
});
