import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, POST } from '@/app/api/theorem/control-center/route';

describe('/api/theorem/control-center', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns the complete backend state for the Agent Workroom Control Center', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;
    const response = await GET();
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      targetSurface: 'app.theoremharness.com',
      health: expect.any(Object),
    });
    expect(Array.isArray(payload.workrooms)).toBe(true);
    expect(Array.isArray(payload.approvals)).toBe(true);
    expect(Array.isArray(payload.receipts)).toBe(true);
    expect(Array.isArray(payload.routes)).toBe(true);
    expect(Array.isArray(payload.setup)).toBe(true);
    expect(Array.isArray(payload.tools)).toBe(true);
    expect(Array.isArray(payload.skillCandidates)).toBe(true);
    expect(Array.isArray(payload.reconstructionPackets)).toBe(true);
    expect(Array.isArray(payload.evals)).toBe(true);
  });

  it('accepts approval decisions and returns an audit receipt', async () => {
    const response = await POST(
      new Request('http://localhost/api/theorem/control-center', {
        method: 'POST',
        body: JSON.stringify({
          action: 'approval_decision',
          approvalId: 'approval:file-write-review',
          decision: 'deny',
          actor: 'travis',
        }),
      }),
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      action: 'approval_decision',
      approval: {
        id: 'approval:file-write-review',
        status: 'denied',
      },
      receipt: {
        kind: 'approval',
        actor: 'travis',
      },
    });
  });

  it('returns request errors for invalid actions', async () => {
    const response = await POST(
      new Request('http://localhost/api/theorem/control-center', {
        method: 'POST',
        body: JSON.stringify({
          action: 'approval_decision',
          approvalId: 'approval:file-write-review',
          decision: 'forever',
        }),
      }),
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      error: 'invalid_control_center_action',
    });
  });

  it('runs setup checks through GET-only probes', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;
    const response = await POST(
      new Request('http://localhost/api/theorem/control-center', {
        method: 'POST',
        body: JSON.stringify({
          action: 'setup_check',
          checkId: 'setup:hosted-harness',
        }),
      }),
    );
    const payload = (await response.json()) as { setup?: Array<{ status?: string; checkOnly?: boolean }> };

    expect(response.status).toBe(200);
    expect(payload.setup?.[0]).toMatchObject({
      status: 'ready',
      checkOnly: true,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://rustyredcore-theorem-production.up.railway.app/healthz',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });
});
