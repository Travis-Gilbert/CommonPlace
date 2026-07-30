// SOURCING: none. Same-origin MCP bridge for programmable_graph PG2 actions.

import { NextResponse } from 'next/server';
import { callHarnessMcp } from '@/lib/server/harness-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  readonly tool?: 'programmable_graph' | 'programmable_graph_apply';
  readonly action?: string;
  readonly args?: Record<string, unknown>;
};

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const tool = body.tool ?? 'programmable_graph';
  const action = body.action;
  if (!action || typeof action !== 'string') {
    return NextResponse.json({ error: 'action_required' }, { status: 400 });
  }
  const result = await callHarnessMcp(tool, {
    action,
    ...(body.args ?? {}),
  });
  if (!result.ok) return result.response;
  return NextResponse.json(result.data);
}
