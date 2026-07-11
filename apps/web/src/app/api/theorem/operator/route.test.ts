import { describe, expect, it } from 'vitest';

import { POST } from './route';

async function postOperator(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await POST(
    new Request('http://localhost/api/theorem/operator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('/api/theorem/operator', () => {
  it('maps malformed actions to 400', async () => {
    const result = await postOperator({ action: 'not_real' });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('invalid_action');
  });

  it('maps missing resources to 404', async () => {
    const result = await postOperator({
      action: 'reorder_queue',
      taskId: 'missing-task',
      priority: 1,
    });

    expect(result.status).toBe(404);
    expect(result.body.error).toBe('task_not_found');
  });

  it('keeps structural operator refusals as 409 conflicts', async () => {
    const result = await postOperator({
      action: 'send_to_bay',
      taskId: 'task_gl1_ledger',
      head: 'claude-code',
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe('bay_occupied');
  });
});
