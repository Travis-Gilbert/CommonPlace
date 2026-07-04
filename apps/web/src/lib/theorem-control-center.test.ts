import { describe, expect, it, vi } from 'vitest';

import {
  buildTheoremControlCenterStateLive,
  buildTheoremControlCenterState,
  handleTheoremControlCenterAction,
  normalizeAction,
  THEOREM_CONTROL_CENTER_SURFACE,
} from '@/lib/theorem-control-center';

describe('theorem control center contract', () => {
  it('builds the app.theoremharness.com backend contract without leaking secrets', () => {
    const state = buildTheoremControlCenterState(
      {
        DEEPSEEK_API_KEY: 'deepseek-secret',
        THEOREM_API_KEY: 'theorem-secret',
        THEOREM_GRAPHQL_URL: 'https://user:password@example.test/graphql?token=secret',
      },
      new Date('2026-07-02T12:00:00.000Z'),
    );

    expect(state.targetSurface).toBe(THEOREM_CONTROL_CENTER_SURFACE);
    expect(state.workrooms.length).toBeGreaterThan(0);
    expect(state.approvals[0]).toMatchObject({
      riskClass: 'write',
      isolationTier: 'trusted_local',
      actions: ['approve_once', 'remember', 'deny'],
    });
    expect(state.routes.map((route) => route.id)).toEqual([
      'route:acp:deepseek',
      'route:proxy:codex',
      'route:graphql:commonplace',
    ]);
    expect(state.routes[2]).toMatchObject({
      provider: 'theorem-commonplace-api',
      runtime: 'CommonPlace API proxy',
      channel: 'GraphQL',
    });
    expect(JSON.stringify(state)).not.toContain('deepseek-secret');
    expect(JSON.stringify(state)).not.toContain('theorem-secret');
    expect(JSON.stringify(state)).not.toContain('password');
    expect(JSON.stringify(state)).not.toContain('token=secret');
  });

  it('normalizes approval decisions into durable receipts', async () => {
    const result = await handleTheoremControlCenterAction(
      {
        action: 'approval_decision',
        approvalId: 'approval:file-write-review',
        decision: 'approve_once',
        actor: 'travis',
      },
      {},
      new Date('2026-07-02T12:00:00.000Z'),
    );

    expect(result.ok).toBe(true);
    expect(result.approval).toMatchObject({
      id: 'approval:file-write-review',
      status: 'approved',
    });
    expect(result.receipt).toMatchObject({
      kind: 'approval',
      actor: 'travis',
      workroomId: 'workroom:agent-control-center',
    });
  });

  it('runs check-only setup probes without model execution', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ ok: true, url: String(input) }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await handleTheoremControlCenterAction(
      { action: 'setup_check', checkId: 'setup:proxy-status' },
      { THEOREM_PROXY_URL: 'http://127.0.0.1:8788' },
      new Date('2026-07-02T12:00:00.000Z'),
      fetchMock,
    );

    expect(result.ok).toBe(true);
    expect(result.setup).toHaveLength(1);
    expect(result.setup?.[0]).toMatchObject({
      id: 'setup:proxy-status',
      status: 'ready',
      checkOnly: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8788/status',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('maps live proxy, harness runs, and connector sources behind the same DTOs', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/status')) {
        return jsonResponse({
          ok: true,
          total_requests_seen: 9,
          openai_responses_seen: 4,
          anthropic_messages_seen: 5,
        });
      }
      if (url.endsWith('/harness/runs')) {
        return jsonResponse({
          runs: [
            {
              run_id: 'run-live-1',
              task: 'Ship Workrooms as a real space',
              actor: 'codex',
              status: 'running',
              updated_at: '2026-07-02T14:00:00.000Z',
              agent_host: 'codex',
            },
          ],
        });
      }
      if (url.endsWith('/harness/jobs/counts')) {
        return jsonResponse({
          dispatch_configured: true,
          counts: [
            { state: 'pending', count: 2 },
            { state: 'running', count: 1 },
          ],
        });
      }
      if (url.includes('/harness/runs/run-live-1')) {
        return jsonResponse({
          run: { run_id: 'run-live-1' },
          events: [
            {
              event_id: 'event-1',
              run_id: 'run-live-1',
              seq: 1,
              type: 'HOST.OBSERVED',
              payload: { summary: 'Observed backend route contract.' },
              created_at: '2026-07-02T14:01:00.000Z',
            },
          ],
        });
      }
      if (url.includes('/connectors')) {
        return jsonResponse({
          connectors: ['websearch'],
          affordances: [{ server_id: 'websearch', tool_name: 'search', label: 'Web Search' }],
        });
      }
      if (url.endsWith('/mcp')) {
        return jsonResponse({
          result: {
            structuredContent: {
              data: {
                memory: [
                  {
                    id: 'doc-live-memory',
                    kind: 'decision',
                    title: 'CommonPlace app surface boundary',
                    contentPreview: 'app.theoremharness.com renders Workrooms, Approvals, and Receipts through CommonPlace.',
                    status: 'active',
                    updatedAt: '2026-07-02T14:02:00.000Z',
                  },
                ],
              },
            },
          },
        });
      }
      return jsonResponse({ ok: true });
    }) as unknown as typeof fetch;

    const state = await buildTheoremControlCenterStateLive(
      {
        THEOREM_HARNESS_URL: 'https://harness.example.test',
        THEOREM_PROXY_URL: 'http://127.0.0.1:8788',
        THEOREM_LOCAL_NODE_URL: 'http://127.0.0.1:8380',
      },
      new Date('2026-07-02T12:00:00.000Z'),
      fetchMock,
    );

    expect(state.source.mode).toBe('live');
    expect(state.routes.find((route) => route.id === 'route:proxy:codex')).toMatchObject({
      status: 'ready',
      counters: {
        requestsSeen: 9,
        openaiResponsesSeen: 4,
        anthropicMessagesSeen: 5,
      },
    });
    expect(state.workrooms[0]).toMatchObject({
      id: 'workroom:run-live-1',
      state: 'running',
      latestReceiptId: 'receipt:run-live-1:event-1',
    });
    expect(state.workrooms.find((workroom) => workroom.id === 'workroom:dispatch-jobs')).toMatchObject({
      state: 'running',
      latestReceiptId: 'receipt:dispatch-jobs:counts',
      artifactCount: 3,
    });
    expect(state.receipts[0]).toMatchObject({
      id: 'receipt:run-live-1:event-1',
      kind: 'command',
      summary: 'Observed backend route contract.',
    });
    expect(state.receipts.find((receipt) => receipt.id === 'receipt:dispatch-jobs:counts')).toMatchObject({
      kind: 'trace',
      summary: expect.stringContaining('pending 2'),
    });
    expect(state.memory.blocks[0]).toMatchObject({
      id: 'memory:block:doc-live-memory',
      source: { mode: 'live' },
    });
    expect(state.tools[0]).toMatchObject({
      id: 'tool:websearch',
      status: 'ready',
      permissionSummary: expect.stringContaining('search'),
    });
  });

  it('maps configured desktop held runs into approval cards and approve receipts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/runs') && init?.method === 'GET') {
        return jsonResponse({
          runs: [
            {
              run_id: 'run_abc',
              state: 'awaiting_authorization',
              spec: {
                intent: 'Apply the backend route contract',
                action_tier: 'tier_2',
              },
            },
          ],
        });
      }
      if (url.endsWith('/v1/runs/run_abc/approve') && init?.method === 'POST') {
        return jsonResponse({
          run: {
            run_id: 'run_abc',
            state: 'running',
            spec: {
              intent: 'Apply the backend route contract',
              action_tier: 'tier_2',
            },
          },
        });
      }
      return jsonResponse({});
    }) as unknown as typeof fetch;
    const env = {
      THEOREM_DESKTOP_RUNTIME_URL: 'http://127.0.0.1:4848',
      THEOREM_DESKTOP_RUNTIME_TOKEN: 'desktop-secret',
    };

    const state = await buildTheoremControlCenterStateLive(env, new Date('2026-07-02T12:00:00.000Z'), fetchMock);
    expect(state.approvals[0]).toMatchObject({
      id: 'approval:desktop-run:run_abc',
      riskClass: 'write',
      actions: ['approve_once', 'deny'],
    });
    expect(JSON.stringify(state)).not.toContain('desktop-secret');

    const result = await handleTheoremControlCenterAction(
      {
        action: 'approval_decision',
        approvalId: 'approval:desktop-run:run_abc',
        decision: 'approve_once',
        actor: 'travis',
      },
      env,
      new Date('2026-07-02T12:03:00.000Z'),
      fetchMock,
    );

    expect(result).toMatchObject({
      ok: true,
      message: 'Desktop runtime approval approved.',
      receipt: {
        kind: 'approval',
        actor: 'travis',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4848/v1/runs/run_abc/approve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer desktop-secret',
        }),
      }),
    );
  });

  it('rejects malformed action payloads clearly', () => {
    expect(() => normalizeAction({ action: 'memory_action', blockId: 'x', memoryAction: 'erase' })).toThrow(
      /memory_action requires memoryAction/,
    );
  });
});

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}
