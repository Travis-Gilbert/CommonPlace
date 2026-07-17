// SOURCING: @commonplace/theorem-acp (bridge, session manager, hosted ACP
// client; extracted from apps/web per porting by extraction). The console
// chat wire (HANDOFF-CONSOLE-ROUND-2 R2.2): accepts the console composer's
// POST shape, drives the real hosted Theorem ACP session, and adapts the
// bridge's full-state snapshot stream into the incremental delta SSE frames
// the console thread already parses (src/lib/chat-delta.ts). On upstream
// failure the response names the error; nothing here fakes a reply (the
// no-theater rule).

import {
  BridgeCommandError,
  dispatchBridgeCommands,
  resolveBridgeSession,
  streamHeaders,
  type BridgeCommand,
} from '@commonplace/theorem-acp/bridge';
import { deltaStream, readText } from '@/lib/chat-delta';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const text = readText(await request.json().catch(() => null));
    const command: BridgeCommand = {
      type: 'add-message',
      message: { role: 'user', parts: [{ type: 'text', text }] },
      parentId: null,
      sourceId: null,
    };
    const session = await resolveBridgeSession({});
    await dispatchBridgeCommands(session, [command]);
    return new Response(
      deltaStream((listener) => session.subscribe(listener), session.getState(), request.signal),
      { status: 200, headers: streamHeaders() },
    );
  } catch (error) {
    const status = error instanceof BridgeCommandError ? error.status : 502;
    const message =
      error instanceof Error ? error.message : 'The hosted Theorem ACP session is unavailable.';
    return Response.json({ error: 'console_chat_wire_failed', message }, { status });
  }
}
