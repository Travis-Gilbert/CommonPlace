import { afterEach, describe, expect, it, vi } from 'vitest';

const { callHarnessMcpMock } = vi.hoisted(() => ({ callHarnessMcpMock: vi.fn() }));
vi.mock('@/lib/server/harness-mcp', () => ({ callHarnessMcp: callHarnessMcpMock }));

import { POST } from '@/app/api/harness/plan/route';

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
});
