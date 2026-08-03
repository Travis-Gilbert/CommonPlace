// SOURCING: vitest. Assertions are V1's four acceptance clauses.
import { describe, expect, it, vi } from 'vitest';
import { SubstrateClient, invalidationsUrlFrom, type EventSourceLike } from '../src/substrate/client';

interface Answer {
  generation: number;
}

/** Fetch double returning a GraphQL envelope, or a transport failure. */
function fetchReturning(answers: (Answer | 'boom' | number)[]): typeof fetch {
  let call = 0;
  return (async () => {
    const answer = answers[Math.min(call++, answers.length - 1)];
    if (answer === 'boom') throw new Error('ECONNREFUSED');
    if (typeof answer === 'number') {
      return { ok: false, status: answer } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { probe: answer } }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

class FakeEventSource implements EventSourceLike {
  static last: FakeEventSource | undefined;
  private listeners: ((event: MessageEvent<string>) => void)[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }

  addEventListener(_type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.push(listener);
  }

  /** Push one frame. Default is an unparseable one, as the stream's opener is. */
  emit(data = '{}'): void {
    for (const listener of this.listeners) listener({ data } as MessageEvent<string>);
  }

  emitInvalidation(path: string, generation = 1): void {
    this.emit(JSON.stringify({ path, generation, contentHash: 'blake3:x', projectId: null }));
  }

  close(): void {
    this.closed = true;
  }
}

const PROBE = 'query Probe { probe { generation } }';

function clientWith(answers: (Answer | 'boom' | number)[], log?: (message: string) => void) {
  return new SubstrateClient({
    endpoint: { graphqlUrl: 'http://store.test/graphql' },
    fetchImpl: fetchReturning(answers),
    EventSourceImpl: FakeEventSource,
    ...(log ? { log } : {}),
  });
}

describe('V1 substrate client', () => {
  it('derives the invalidation door from the GraphQL door', () => {
    expect(invalidationsUrlFrom('http://store.test/graphql')).toBe(
      'http://store.test/v1/editor/invalidations',
    );
    expect(invalidationsUrlFrom('http://store.test/graphql', 'proj-1')).toBe(
      'http://store.test/v1/editor/invalidations?projectId=proj-1',
    );
    expect(invalidationsUrlFrom('not a url')).toBeUndefined();
  });

  it('refreshes only the file an invalidation names, leaving the others alone', async () => {
    // The event carries a path, so one file changing must not re-query every
    // open editor. With twenty documents open the old shape did twenty times
    // the work per keystroke somewhere else in the tree.
    const client = clientWith([{ generation: 1 }]);
    const runs: string[] = [];
    const watch = (key: string, path: string) =>
      client.subscribe(
        key,
        async () => {
          runs.push(key);
          return client.query(PROBE, {}, (data: { probe: Answer }) => data.probe.generation);
        },
        () => undefined,
        { path },
      );

    watch('a', '/work/a.ts');
    watch('b', '/work/b.ts');
    watch('readiness', undefined as unknown as string);
    await vi.waitFor(() => expect(runs.length).toBe(3));

    runs.length = 0;
    FakeEventSource.last?.emitInvalidation('/work/a.ts');
    await vi.waitFor(() => expect(runs).toContain('a'));
    // The path-less workspace query has no narrower signal, so it refreshes too.
    expect(runs.sort()).toEqual(['a', 'readiness']);

    client.dispose();
  });

  it('falls back to refreshing everything when a frame says nothing usable', async () => {
    // The stream opens with a comment and may later carry frames this version
    // does not model. Going quietly stale would be worse than one extra query.
    const client = clientWith([{ generation: 1 }]);
    const runs: string[] = [];
    client.subscribe(
      'a',
      async () => {
        runs.push('a');
        return client.query(PROBE, {}, (data: { probe: Answer }) => data.probe.generation);
      },
      () => undefined,
      { path: '/work/a.ts' },
    );
    await vi.waitFor(() => expect(runs.length).toBe(1));

    runs.length = 0;
    FakeEventSource.last?.emit('not json at all');
    await vi.waitFor(() => expect(runs).toEqual(['a']));

    client.dispose();
  });

  it('repaints a subscriber from an invalidation, with no editor interaction', async () => {
    const client = clientWith([{ generation: 1 }, { generation: 2 }]);
    const delivered: number[] = [];

    client.subscribe<{ probe: Answer }>(
      'doc',
      () => client.query(PROBE, {}, (data) => data.probe.generation),
      (result) => {
        if (result.ok) delivered.push(result.data.probe.generation);
      },
    );
    await vi.waitFor(() => expect(delivered).toEqual([1]));

    FakeEventSource.last?.emitInvalidation('/work/doc.ts');
    await vi.waitFor(() => expect(delivered).toEqual([1, 2]));

    client.dispose();
  });

  it('discards an answer stamped below the highest generation seen, and logs it', async () => {
    const lines: string[] = [];
    const client = clientWith([{ generation: 7 }, { generation: 3 }], (message) => lines.push(message));
    const delivered: number[] = [];

    client.subscribe<{ probe: Answer }>(
      'doc',
      () => client.query(PROBE, {}, (data) => data.probe.generation),
      (result) => {
        if (result.ok) delivered.push(result.data.probe.generation);
      },
    );
    await vi.waitFor(() => expect(delivered).toEqual([7]));

    await client.refresh('doc');
    expect(delivered).toEqual([7]);
    expect(lines.some((line) => line.includes('discarded stale answer'))).toBe(true);

    client.dispose();
  });

  it('delivers an equal generation, because two reads of one store are not stale', async () => {
    const client = clientWith([{ generation: 5 }, { generation: 5 }]);
    const delivered: number[] = [];

    client.subscribe<{ probe: Answer }>(
      'doc',
      () => client.query(PROBE, {}, (data) => data.probe.generation),
      (result) => {
        if (result.ok) delivered.push(result.data.probe.generation);
      },
    );
    await vi.waitFor(() => expect(delivered).toEqual([5]));
    await client.refresh('doc');
    expect(delivered).toEqual([5, 5]);

    client.dispose();
  });

  it('answers a dead endpoint with the honest degraded state, never an empty result', async () => {
    const client = clientWith(['boom']);
    const result = await client.query(PROBE, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.degradation.level).toBe('unavailable');
      expect(result.degradation.code).toBe('editor_substrate_unreachable');
      expect(result.degradation.detail).toContain('ECONNREFUSED');
    }
    client.dispose();
  });

  it('reports an HTTP failure with the status that came back', async () => {
    const client = clientWith([503]);
    const result = await client.query(PROBE, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.degradation.detail).toContain('503');
    client.dispose();
  });

  it('closes the invalidation stream when the last subscription goes', async () => {
    const client = clientWith([{ generation: 1 }]);
    const unsubscribe = client.subscribe('doc', () => client.query(PROBE, {}), () => undefined);
    await vi.waitFor(() => expect(FakeEventSource.last).toBeDefined());
    unsubscribe();
    expect(FakeEventSource.last?.closed).toBe(true);
    client.dispose();
  });
});
