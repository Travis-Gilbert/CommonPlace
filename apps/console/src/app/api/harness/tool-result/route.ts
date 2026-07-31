// SOURCING: none. Same-origin adapter for content-addressed spill handles.

import { NextResponse } from 'next/server';
import { callHarnessMcp } from '@/lib/server/harness-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    fetchHandle?: unknown;
    offset?: unknown;
    maxBytes?: unknown;
  } | null;
  const fetchHandle = typeof body?.fetchHandle === 'string' ? body.fetchHandle : '';
  if (!fetchHandle) {
    return NextResponse.json({ error: 'fetch_handle_required' }, { status: 400 });
  }
  const result = await callHarnessMcp('tool_result_fetch', {
    fetch_handle: fetchHandle,
    offset: typeof body?.offset === 'number' ? body.offset : 0,
    max_bytes: typeof body?.maxBytes === 'number' ? body.maxBytes : 65536,
  });
  if (!result.ok) return result.response;
  return NextResponse.json(result.data);
}
