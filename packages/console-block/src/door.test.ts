import { afterEach, describe, expect, it, vi } from 'vitest';
import { SameOriginGraphqlDoor, WasmFixtureDoor } from './door';
import { CORPUS_READ_GRANT } from './plugin';
import type { ConsoleSnapshot } from './types';

const SNAPSHOT: ConsoleSnapshot = {
  contract_version: 'commonplace-console-core/v1',
  overview: { counts_by_type: [['receipt', 2]], generation: 1, readiness: [] },
  entities: [],
  receipts: [
    {
      id: 'receipt:1',
      kind: 'merge',
      subject_id: 'golden:1',
      actor: 'fixture',
      occurred_at_ms: 1,
      summary: 'first',
      evidence: {},
    },
    {
      id: 'receipt:2',
      kind: 'consent',
      subject_id: 'commonplace.console',
      actor: 'fixture',
      occurred_at_ms: 2,
      summary: 'second',
      evidence: {},
    },
  ],
  graph: {
    root: 'node:1',
    depth: 1,
    nodes: [{ id: 'node:1', node_type: 'record', label: 'One' }],
    edges: [],
  },
  standing_queries: [
    { id: 'standing:1', name: 'One', shape: 'record.changed', enabled: true },
  ],
  firings: [
    {
      query_id: 'standing:1',
      sequence: 1,
      occurred_at_ms: 3,
      matched_ids: ['golden:1'],
      receipt_id: 'receipt:watch:1',
    },
  ],
  plugin: {
    app_id: 'commonplace.console',
    version: '1.0.0',
    state: 'installed',
    grants: [CORPUS_READ_GRANT],
    contributions: ['pane:commonplace.console'],
  },
};

function door(grants: readonly string[] = [CORPUS_READ_GRANT]): WasmFixtureDoor {
  return new WasmFixtureDoor(
    grants,
    Promise.resolve({
      snapshot: SNAPSHOT,
      layoutFingerprint: () => 1n,
      settledLayoutFingerprint: () => 1n,
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('WASM fixture door', () => {
  it('refuses every read without the declared grant', async () => {
    await expect(door([]).snapshot()).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('applies typed filters and bounded pagination', async () => {
    const first = await door().receipts({}, { limit: 1 });
    expect(first).toMatchObject({ total: 2, next_cursor: '1' });
    expect(first.receipts.map((receipt) => receipt.id)).toEqual(['receipt:1']);

    const filtered = await door().receipts({ kind: 'consent' }, { limit: 10 });
    expect(filtered.receipts.map((receipt) => receipt.id)).toEqual(['receipt:2']);
  });

  it.each(['', ' ', '0x1', '1e2', '-1', '+1'])(
    'rejects non-decimal receipt cursor %j',
    async (cursor) => {
      await expect(door().receipts({}, { limit: 1, cursor })).rejects.toMatchObject({
        code: 'invalid_request',
      });
    },
  );

  it('subscribes only to the caller-selected watch shape', async () => {
    const fixture = door();
    const sequences: number[] = [];
    const unsubscribe = await fixture.subscribe(
      { query_id: 'standing:1' },
      (event) => sequences.push(event.sequence),
    );
    fixture.emitFixtureFiring({ ...SNAPSHOT.firings[0]!, sequence: 2 });
    unsubscribe();
    fixture.emitFixtureFiring({ ...SNAPSHOT.firings[0]!, sequence: 3 });
    expect(sequences).toEqual([1, 2]);
  });
});

describe('same-origin GraphQL door', () => {
  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [503, 'unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));

    await expect(new SameOriginGraphqlDoor([CORPUS_READ_GRANT]).snapshot()).rejects.toMatchObject({
      code,
      retryable: status >= 500,
    });
  });

  it('rejects an invalid server projection as a typed protocol error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ contract_version: 'unexpected' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(new SameOriginGraphqlDoor([CORPUS_READ_GRANT]).snapshot()).rejects.toMatchObject({
      code: 'protocol',
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/console-plugin/snapshot', {
      credentials: 'same-origin',
    });
  });

  it('rejects malformed nested entity and receipt projections', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...SNAPSHOT,
          entities: [{ record: { id: 'golden:broken' } }],
          receipts: [{ id: 'receipt:broken', kind: 'write' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(new SameOriginGraphqlDoor([CORPUS_READ_GRANT]).snapshot()).rejects.toMatchObject({
      code: 'protocol',
    });
  });
});
