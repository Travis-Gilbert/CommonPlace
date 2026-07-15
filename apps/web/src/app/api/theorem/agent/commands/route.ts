import {
  BridgeCommandError,
  dispatchBridgeCommands,
  resolveBridgeSession,
  validateBridgePayload,
} from '@/server/acp/bridge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readBridgeBody(request);
    const session = await resolveBridgeSession(body);
    await dispatchBridgeCommands(session, body.commands);
    return Response.json(session.getState());
  } catch (error) {
    const status = error instanceof BridgeCommandError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Theorem ACP bridge failed.';
    return Response.json({ error: 'theorem_acp_bridge_failed', message }, { status });
  }
}

async function readBridgeBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return validateBridgePayload(await request.json());
  } catch (error) {
    if (error instanceof BridgeCommandError) throw error;
    throw new BridgeCommandError('Expected a JSON request body.', 400);
  }
}
