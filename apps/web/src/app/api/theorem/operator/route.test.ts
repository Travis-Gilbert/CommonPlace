import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { GET, POST } from './route';

const OPEN_TASK = {
  id: 'task-a',
  runId: 'run-1',
  parentId: null,
  nodeType: 'implement',
  goal: 'Ship the live contract',
  prerequisites: [],
  fileScope: ['apps/web/src/app/api/theorem/operator/route.ts'],
  status: 'open',
  claim: null,
  claimEpoch: 0,
  receipts: [],
  createdBy: 'codex',
  reviewRequiredBy: null,
};

function mcpResponse(value: unknown): Response {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: 'operator-test',
    result: { structuredContent: value },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function workGraph(tasks: unknown[] = [OPEN_TASK]): unknown {
  return {
    data: {
      workGraph: {
        ok: true,
        run: { tenant_slug: 'Travis-Gilbert', run_id: 'run-1' },
        tasks,
      },
    },
  };
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, call: number): {
  params: { name: string; arguments: { query: string; variables: Record<string, unknown> } };
} {
  const [, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return JSON.parse(init.body as string) as {
    params: { name: string; arguments: { query: string; variables: Record<string, unknown> } };
  };
}

describe('/api/theorem/operator live contract', () => {
  const originalFetch = globalThis.fetch;
  const authMock = vi.mocked(auth);

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { isOwner: true } } as never);
    vi.stubEnv('THEOREM_OPERATOR_RUN_ID', 'run-1');
    vi.stubEnv('THEOREM_MCP_URL', 'https://harness.example.test/mcp');
    vi.stubEnv('THEOREM_MCP_AUTH_TOKEN', 'tenant-bound-token');
    vi.stubEnv('THEOREM_TENANT_SLUG', 'Travis-Gilbert');
    vi.stubEnv('THEOREM_OPERATOR_HEADS', 'claude-code,codex');
    vi.stubEnv('THEOREM_OPERATOR_CREDENTIAL_ID', 'operator-test');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated reads before contacting the harness', async () => {
    authMock.mockResolvedValueOnce(null as never);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await GET(new Request('http://localhost/api/theorem/operator'));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts the dedicated operator bearer token without a session', async () => {
    authMock.mockResolvedValueOnce(null as never);
    vi.stubEnv('THEOREM_OPERATOR_API_TOKEN', 'operator-route-token');
    const fetchMock = vi.fn(async () => mcpResponse(workGraph([])));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await GET(new Request('http://localhost/api/theorem/operator', {
      headers: { authorization: 'Bearer operator-route-token' },
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('can use the dedicated token when session resolution is unavailable', async () => {
    authMock.mockRejectedValueOnce(new Error('Auth configuration unavailable'));
    vi.stubEnv('THEOREM_OPERATOR_API_TOKEN', 'operator-route-token');
    const fetchMock = vi.fn(async () => mcpResponse(workGraph([])));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await GET(new Request('http://localhost/api/theorem/operator', {
      headers: { authorization: 'Bearer operator-route-token' },
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a bearer token without an unambiguous credential id', async () => {
    authMock.mockResolvedValueOnce(null as never);
    vi.stubEnv('THEOREM_OPERATOR_API_TOKEN', 'operator-route-token');
    vi.stubEnv('THEOREM_OPERATOR_CREDENTIAL_ID', '');
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await GET(new Request('http://localhost/api/theorem/operator', {
      headers: { authorization: 'Bearer operator-route-token' },
    }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 instead of fixtures when the run contract is not configured', async () => {
    vi.stubEnv('THEOREM_OPERATOR_RUN_ID', '');
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await GET(new Request('http://localhost/api/theorem/operator'));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      error: 'operator_live_not_configured',
      tenant: 'Travis-Gilbert',
    });
    expect(JSON.stringify(payload)).not.toContain('task_gl1_ledger');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves an honest live empty state', async () => {
    const fetchMock = vi.fn(async () => mcpResponse(workGraph([])));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await GET(new Request('http://localhost/api/theorem/operator'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      source: { mode: 'live' },
      contract: { tenant: 'Travis-Gilbert', runId: 'run-1' },
      tasks: [],
      heads: [{ id: 'claude-code' }, { id: 'codex' }],
      bays: [{ head: 'claude-code' }, { head: 'codex' }],
      gate: [],
      drawers: {},
    });
    expect(payload.shiftSummary.queueDepth).toBe(0);
    expect(JSON.stringify(payload)).not.toContain('task_gl1_ledger');

    const call = requestBody(fetchMock, 0);
    expect(call.params.name).toBe('graphql_query');
    expect(call.params.arguments.variables).toEqual({ runId: 'run-1' });
    expect(call.params.arguments.query).toContain('query OperatorWorkGraph($runId:String!)');
  });

  it('claims a task through graphql_mutate and returns a verified claim receipt', async () => {
    let workGraphReads = 0;
    let auditMetadata: Record<string, unknown> = {};
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(init?.body as string) as {
        params: { name: string; arguments: { query: string } };
      };
      if (request.params.name === 'graphql_query' && request.params.arguments.query.includes('OperatorWorkGraph')) {
        workGraphReads += 1;
        const task = workGraphReads === 1
          ? OPEN_TASK
          : {
              ...OPEN_TASK,
              status: 'claimed',
              claimEpoch: 1,
              claim: { owner: 'claude-code', epoch: 1, grantedAt: 1, expiresAt: 2, lastHeartbeat: 1 },
            };
        return mcpResponse(workGraph([task]));
      }
      if (request.params.name === 'graphql_query') {
        return mcpResponse({
          data: {
            graphNode: {
              id: 'harness:coordination:record:Travis-Gilbert:task-a:record-claim-1',
              properties: {
                tenant_slug: 'Travis-Gilbert',
                room_id: 'task-a',
                record_id: 'record:claim:1',
                record_type: 'event',
                actor_id: 'commonplace:github:Travis-Gilbert',
                metadata: auditMetadata,
              },
            },
          },
        });
      }
      if (request.params.arguments.query.includes('OperatorClaimAudit')) {
        const variables = (request as unknown as {
          params: { arguments: { variables: { metadata: Record<string, unknown> } } };
        }).params.arguments.variables;
        auditMetadata = variables.metadata;
        return mcpResponse({
          data: {
            writeCoordinationRecord: {
              tenant: 'Travis-Gilbert',
              room_id: 'task-a',
              record: {
                record_id: 'record:claim:1',
                record_type: 'event',
                actor_id: 'commonplace:github:Travis-Gilbert',
                metadata: auditMetadata,
              },
            },
          },
        });
      }
      return mcpResponse({
        data: {
          claimTaskNode: {
            tenant: 'Travis-Gilbert',
            ok: true,
            task: {
              id: 'task-a',
              run_id: 'run-1',
              claim_epoch: 1,
              claim: { owner: 'claude-code' },
            },
          },
        },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await POST(new Request('http://localhost/api/theorem/operator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'send_to_bay', taskId: 'task-a', head: 'claude-code' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      action: 'send_to_bay',
      receipt: {
        id: 'claim:run-1:task-a:1',
        mutation: 'claimTaskNode',
        tenant: 'Travis-Gilbert',
        verified: true,
      },
    });

    const mutation = requestBody(fetchMock, 1);
    expect(mutation.params.name).toBe('graphql_mutate');
    expect(mutation.params.arguments.variables).toMatchObject({
      runId: 'run-1',
      nodeId: 'task-a',
      owner: 'claude-code',
      expectedEpoch: 0,
      actor: 'commonplace:github:Travis-Gilbert',
    });
    expect(payload.receipt.auditId).toBe('record:claim:1');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('rejects a workGraph from the wrong tenant or run', async () => {
    const fetchMock = vi.fn(async () => mcpResponse({
      data: {
        workGraph: {
          ok: true,
          run: { tenant_slug: 'another-tenant', run_id: 'run-2' },
          tasks: [{ ...OPEN_TASK, runId: 'run-2' }],
        },
      },
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await GET(new Request('http://localhost/api/theorem/operator'));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: 'operator_live_invalid_response',
      tenant: 'Travis-Gilbert',
    });
  });

  it('refuses actions that have no durable mutation instead of claiming success', async () => {
    const fetchMock = vi.fn(async () => mcpResponse(workGraph()));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await POST(new Request('http://localhost/api/theorem/operator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reorder_queue', taskId: 'task-a', priority: 1 }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(501);
    expect(payload).toMatchObject({
      ok: false,
      action: 'reorder_queue',
      error: 'mutation_not_implemented',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed action fields without attempting a mutation', async () => {
    const fetchMock = vi.fn(async () => mcpResponse(workGraph()));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await POST(new Request('http://localhost/api/theorem/operator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'send_room_message', taskId: 'task-a', text: 42 }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      action: 'unknown',
      error: 'invalid_action',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a claim acknowledgement from a different tenant', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(init?.body as string) as { params: { name: string } };
      if (request.params.name === 'graphql_query') return mcpResponse(workGraph());
      return mcpResponse({
        data: {
          claimTaskNode: {
            tenant: 'another-tenant',
            ok: true,
            task: { claim_epoch: 1, claim: { owner: 'claude-code' } },
          },
        },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await POST(new Request('http://localhost/api/theorem/operator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'send_to_bay', taskId: 'task-a', head: 'claude-code' }),
    }));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      ok: false,
      action: 'send_to_bay',
      error: 'tenant_mismatch',
    });
  });

  it('publishes room messages and returns the durable stream event receipt', async () => {
    authMock.mockResolvedValueOnce(null as never);
    vi.stubEnv('THEOREM_OPERATOR_API_TOKEN', 'operator-route-token');
    vi.stubEnv('THEOREM_OPERATOR_CREDENTIAL_ID', 'release-console');
    const credentialActor = 'commonplace:credential:operator:release-console';
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(init?.body as string) as {
        params: { name: string; arguments: { query: string } };
      };
      if (request.params.name === 'graphql_query') {
        if (request.params.arguments.query.includes('OperatorRoomReceipt')) {
          return mcpResponse({
            data: {
              graphNode: {
                id: 'harness:coordination:stream-event:Travis-Gilbert:task-a:00000000000000000042',
                properties: {
                  id: 'stream-event:42',
                  actor: credentialActor,
                  kind: 'operator-room-message',
                  payload: {
                    taskId: 'task-a',
                    runId: 'run-1',
                    message: 'Please review the contract.',
                  },
                },
              },
            },
          });
        }
        return mcpResponse(workGraph());
      }
      return mcpResponse({
        data: {
          publishCoordinationEvent: {
            ok: true,
            stream: 'task-a',
            eventId: 'stream-event:42',
            orderingToken: 42,
            pinged: true,
            createdAt: '2026-07-11T22:00:00.000Z',
          },
        },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await POST(new Request('http://localhost/api/theorem/operator', {
      method: 'POST',
      headers: {
        authorization: 'Bearer operator-route-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'send_room_message',
        taskId: 'task-a',
        text: 'Please review the contract.',
        mention: 'claude-code',
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      action: 'send_room_message',
      receipt: {
        id: 'stream-event:42',
        mutation: 'publishCoordinationEvent',
        tenant: 'Travis-Gilbert',
        verified: true,
      },
    });

    const mutation = requestBody(fetchMock, 1);
    expect(mutation.params.arguments.variables).toMatchObject({
      stream: 'task-a',
      targetActor: 'claude-code',
      payload: {
        taskId: 'task-a',
        runId: 'run-1',
        message: 'Please review the contract.',
      },
      actor: credentialActor,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
