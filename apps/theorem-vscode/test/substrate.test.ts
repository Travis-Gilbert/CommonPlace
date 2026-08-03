// SOURCING: vitest. Assertions are V1's four acceptance clauses.
import { describe, expect, it, vi } from 'vitest';
import { SubstrateClient, type EventSourceLike } from '../src/substrate/client';

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

  emit(): void {
    for (const listener of this.listeners) listener({ data: '{}' } as MessageEvent<string>);
  }

  close(): void {
    this.closed = true;
  }
}

const PROBE = 'query Probe { probe { generation } }';

function clientWith(answers: (Answer | 'boom' | number)[], log?: (message: string) => void) {
  return new SubstrateClient({
    endpoint: { graphqlUrl: 'http://store.test/graphql', changefeedUrl: 'http://store.test/feed' },
    fetchImpl: fetchReturning(answers),
    EventSourceImpl: FakeEventSource,
    ...(log ? { log } : {}),
  });
}

describe('V1 substrate client', () => {
  it('repaints a subscriber from a changefeed event, with no editor interaction', async () => {
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

    FakeEventSource.last?.emit();
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

  it('closes the changefeed when the last subscription goes', async () => {
    const client = clientWith([{ generation: 1 }]);
    const unsubscribe = client.subscribe('doc', () => client.query(PROBE, {}), () => undefined);
    await vi.waitFor(() => expect(FakeEventSource.last).toBeDefined());
    unsubscribe();
    expect(FakeEventSource.last?.closed).toBe(true);
    client.dispose();
  });
});
