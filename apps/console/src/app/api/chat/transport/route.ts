// SOURCING: @commonplace/theorem-acp bridge. CH2: AssistantTransport surface.
// Verify First found no A2A v1.0 endpoint in theorem-acp; the harness emits
// TheoremAgentState snapshots via createStateStream, which is the
// AssistantTransport protocol. LocalRuntime is excluded.

import {
  BridgeCommandError,
  createStateStream,
  dispatchBridgeCommands,
  resolveBridgeSession,
  streamHeaders,
  validateBridgePayload,
} from '@commonplace/theorem-acp/bridge';
import {
  getThread,
  updateThread,
} from '@/lib/chat/server-catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readBody(request);
    const threadId = typeof body.threadId === 'string' ? body.threadId : null;
    if (threadId) {
      const thread = getThread(threadId);
      if (thread?.sessionId && (!body.state || typeof body.state !== 'object')) {
        body.state = { sessionId: thread.sessionId };
      } else if (thread?.sessionId && body.state && typeof body.state === 'object') {
        const state = body.state as Record<string, unknown>;
        if (typeof state.sessionId !== 'string') state.sessionId = thread.sessionId;
      }
    }
    const session = await resolveBridgeSession(body);
    await dispatchBridgeCommands(session, body.commands);
    const sessionId = session.getState().sessionId;
    if (threadId && sessionId) {
      try {
        updateThread(threadId, { sessionId });
      } catch {
        // Thread may not exist yet; the page creates it before send.
      }
    }
    return new Response(createStateStream(session, request.signal), {
      status: 200,
      headers: streamHeaders(),
    });
  } catch (error) {
    const status = error instanceof BridgeCommandError ? error.status : 502;
    const message =
      error instanceof Error ? error.message : 'The hosted Theorem ACP session is unavailable.';
    return Response.json({ error: 'console_chat_wire_failed', message }, { status });
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const json = await request.json();
    return validateBridgePayload(json);
  } catch (error) {
    if (error instanceof BridgeCommandError) throw error;
    throw new BridgeCommandError('Expected a JSON request body.', 400);
  }
}
