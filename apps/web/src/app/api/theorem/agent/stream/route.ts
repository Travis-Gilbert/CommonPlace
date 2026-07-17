import {
  BridgeCommandError,
  createStateStream,
  dispatchBridgeCommands,
  resolveBridgeSession,
  resolveProcessKey,
  streamHeaders,
  validateBridgePayload,
} from '@/server/acp/bridge';
import { groundChatPrompt } from '@/server/acp/inquiry-grounding';
import type { TheoremAgentState } from '@/server/acp/state';

import {
  buildCompatibilityStates,
  firstUserPrompt,
  isAcpSpawnUnavailable,
  resolveCompatibilityInput,
  runCompatibilityAgent,
} from './compatibility';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readBridgeBody(request);
    try {
      await groundBridgeCommands(body, request);
      const session = await resolveBridgeSession(body);
      await dispatchBridgeCommands(session, body.commands);
      return new Response(createStateStream(session, request.signal), {
        status: 200,
        headers: streamHeaders(),
      });
    } catch (error) {
      if (!isAcpSpawnUnavailable(error) && !isHostedAcpUnavailable(error)) throw error;
      return compatibilityStreamResponse(body, request.signal);
    }
  } catch (error) {
    const status = error instanceof BridgeCommandError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Theorem ACP bridge failed.';
    return Response.json({ error: 'theorem_acp_bridge_failed', message }, { status });
  }
}

async function groundBridgeCommands(
  body: Record<string, unknown>,
  request: Request,
): Promise<void> {
  if (!Array.isArray(body.commands)) return;
  for (const command of body.commands) {
    if (!command || typeof command !== 'object') continue;
    const record = command as {
      type?: unknown;
      message?: { role?: unknown; parts?: Array<{ type?: unknown; text?: unknown }> };
    };
    if (record.type !== 'add-message' || record.message?.role !== 'user') continue;
    if (!Array.isArray(record.message.parts)) continue;
    const text = record.message.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => String(part.text).trim())
      .filter(Boolean)
      .join('\n');
    if (!text) continue;
    const grounded = await groundChatPrompt(text, request);
    record.message.parts = [{ type: 'text', text: grounded.prompt }];
  }
}

function isHostedAcpUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('hosted acp') ||
    message.includes('websocket') ||
    message.includes('start_session') ||
    message.includes('agent stdout is no longer readable')
  );
}

async function readBridgeBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return validateBridgePayload(await request.json());
  } catch (error) {
    if (error instanceof BridgeCommandError) throw error;
    throw new BridgeCommandError('Expected a JSON request body.', 400);
  }
}

async function compatibilityStreamResponse(
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Response> {
  const prompt = firstUserPrompt(body.commands);
  if (!prompt) {
    throw new BridgeCommandError('Expected an add-message command for compatibility mode.', 400);
  }

  const key = resolveProcessKey(body);
  let states: TheoremAgentState[];
  try {
    const answer = await runCompatibilityAgent(resolveCompatibilityInput(body, prompt));
    states = buildCompatibilityStates(key, prompt, { ok: true, ...answer });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Compatibility agent failed after the hosted Theorem ACP session was unavailable.';
    states = buildCompatibilityStates(key, prompt, { ok: false, message });
  }

  return new Response(createCompatibilityStateStream(states, signal), {
    status: 200,
    headers: streamHeaders(),
  });
}

function createCompatibilityStateStream(
  states: TheoremAgentState[],
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (signal.aborted) {
        controller.close();
        return;
      }
      for (const state of states) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'update-state',
              path: [],
              operations: [{ type: 'set', path: [], value: state }],
            })}\n\n`,
          ),
        );
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}
