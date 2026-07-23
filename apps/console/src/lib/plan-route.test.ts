import { afterEach, describe, expect, it, vi } from 'vitest';

const { callHarnessMcpMock } = vi.hoisted(() => ({ callHarnessMcpMock: vi.fn() }));
vi.mock('@/lib/server/harness-mcp', () => ({ callHarnessMcp: callHarnessMcpMock }));

import { GET, POST } from '@/app/api/harness/plan/route';

const principal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'github:owner',
};

describe('Plan mutation route', () => {
  afterEach(() => callHarnessMcpMock.mockReset());

  it('maps a typed Plan refusal to actionable HTTP 409 detail', async () => {
    callHarnessMcpMock.mockResolvedValue({
      ok: true,
      principal,
      data: {
        refused: true,
        rule: 'approval_required',
        detail: 'A destructive affordance requires a receipt.',
        receipt_id: 'refusal:1',
      },
    });
    const response = await POST(new Request('https://console.test/api/harness/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'plan:1', action: 'approval_decision', taskId: 'task:1', decision: 'allow' }),
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'plan_action_refused',
      rule: 'approval_required',
      detail: 'A destructive affordance requires a receipt.',
      receiptId: 'refusal:1',
    });
  });

  it('maps the canonical nested refusal envelope to HTTP 409', async () => {
    callHarnessMcpMock.mockResolvedValue({
      ok: true,
      principal,
      data: {
        ok: false,
        refusal: {
          code: 'single_in_progress',
          detail: 'This head already has an in-progress task.',
          receipt_id: 'refusal:2',
        },
      },
    });
    const response = await POST(new Request('https://console.test/api/harness/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'plan:1', action: 'report_progress', taskId: 'task:1', fraction: 0.5 }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'plan_action_refused',
      rule: 'single_in_progress',
      detail: 'This head already has an in-progress task.',
      receiptId: 'refusal:2',
    });
  });

  it('materializes a side-effecting completed plan as a non-executing advisory program', async () => {
    callHarnessMcpMock
      .mockResolvedValueOnce({
        ok: true,
        principal,
        data: completedPlan([{
          ref: 'github:create_release',
          annotations: ['destructive'],
        }]),
      })
      .mockResolvedValueOnce({ ok: true, principal, data: { ok: true, program_id: 'program:side-effect' } });
    const response = await POST(new Request('https://console.test/api/harness/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'plan:1', action: 'save_as_program', bindings: {} }),
    }));

    expect(response.status).toBe(200);
    expect(callHarnessMcpMock).toHaveBeenNthCalledWith(2, 'programmable_graph_apply', {
      action: 'materialize',
      program: expect.objectContaining({
        tenant_id: 'Travis-Gilbert',
        authority: 'advisory',
        approval: { mode: 'require_each_run', grant_ids: [] },
        metadata: expect.objectContaining({
          execution_mode: 'advisory_proposal_only',
          source_side_effecting_affordance_refs: ['github:create_release'],
        }),
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: 'task:1',
            affordance_id: 'plan-task:complete',
            contract: expect.objectContaining({
              capabilities: [expect.objectContaining({ has_side_effects: false })],
            }),
          }),
        ]),
      }),
    });
  });

  it('materializes a read-only completed plan as an advisory program', async () => {
    callHarnessMcpMock
      .mockResolvedValueOnce({
        ok: true,
        principal,
        data: completedPlan([{
          ref: 'github:get_release',
          annotations: ['read_only'],
        }]),
      })
      .mockResolvedValueOnce({ ok: true, principal, data: { ok: true, program_id: 'program:1' } });
    const response = await POST(new Request('https://console.test/api/harness/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'plan:1', action: 'save_as_program', bindings: {} }),
    }));

    expect(response.status).toBe(200);
    expect(callHarnessMcpMock).toHaveBeenNthCalledWith(2, 'programmable_graph_apply', {
      action: 'materialize',
      program: expect.objectContaining({
        tenant_id: 'Travis-Gilbert',
        authority: 'advisory',
        approval: { mode: 'require_each_run', grant_ids: [] },
      }),
    });
  });
});

describe('Plan poll route', () => {
  afterEach(() => callHarnessMcpMock.mockReset());

  it('keeps the event cursor stable when what_changed is degraded and still refreshes the runs rail', async () => {
    callHarnessMcpMock
      .mockResolvedValueOnce({ ok: true, principal, data: completedPlan([]) })
      .mockResolvedValueOnce({ ok: false, principal, response: Response.json({ error: 'offline' }, { status: 503 }) })
      .mockResolvedValueOnce({ ok: true, principal, data: { progress: 'current' } });

    const response = await GET(new Request('https://console.test/api/harness/plan?id=plan%3A1&cursor=7&manifest=0'));
    const body = await response.json();

    expect(body.cursor).toBe(7);
    expect(body.degraded.events).toBe(true);
    expect(body.runsRail).toHaveLength(1);
    expect(callHarnessMcpMock).toHaveBeenNthCalledWith(3, 'plan', {
      action: 'query',
      plan_id: 'plan:1',
      query: 'progress',
    });
  });

  it('advances the cursor only from the successful event response', async () => {
    callHarnessMcpMock
      .mockResolvedValueOnce({ ok: true, principal, data: { ...completedPlan([]), rows: [{ graph_version: 30 }] } })
      .mockResolvedValueOnce({ ok: true, principal, data: { rows: [{ graph_version: 9 }] } })
      .mockResolvedValueOnce({ ok: true, principal, data: {} });

    const response = await GET(new Request('https://console.test/api/harness/plan?id=plan%3A1&cursor=7&manifest=0'));
    const body = await response.json();

    expect(body.cursor).toBe(9);
  });
});

function completedPlan(queuedAffordances: Array<Record<string, unknown>>) {
  return {
    plan_id: 'plan:1',
    plan: {
      id: 'plan:1',
      title: 'Completed plan',
      objective: 'Promote safely',
    },
    tasks: [{
      id: 'task:1',
      alias: 'complete',
      title: 'Complete the plan',
      status: 'verified',
      queued_affordances: queuedAffordances,
    }],
  };
}
