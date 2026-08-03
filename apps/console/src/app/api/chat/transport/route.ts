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
  validateBridgeCommands,
  validateBridgePayload,
  type BridgeCommand,
} from '@commonplace/theorem-acp/bridge';
import type { AcquiredAcpSession } from '@commonplace/theorem-acp/session-manager';
import type { TurnContext, TurnRoute } from '@commonplace/theorem-acp/state';
import {
  getThread,
  updateThread,
} from '@/lib/chat/server-catalog';
import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import {
  configuredServiceTenantMatches,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';
import { loadInstanceCapabilities } from '@/lib/server/instance-capabilities';
import {
  cohesiveTurnRoutingEnabled,
  routeTurn,
  toTurnContext,
  TurnRouterIdentityError,
} from '@/lib/server/turn-router';
import { loadWebResearch } from '@/lib/server/web-research';
import { appendWebResearch } from '@/lib/web-research-contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const turnId = crypto.randomUUID();
  try {
    const body = await readBody(request);
    const threadId = typeof body.threadId === 'string' ? body.threadId : null;
    if (threadId) {
      const thread = await getThread(threadId);
      if (thread?.sessionId && (!body.state || typeof body.state !== 'object')) {
        body.state = { sessionId: thread.sessionId };
      } else if (thread?.sessionId && body.state && typeof body.state === 'object') {
        const state = body.state as Record<string, unknown>;
        if (typeof state.sessionId !== 'string') state.sessionId = thread.sessionId;
      }
    }
    const commands = validateBridgeCommands(body.commands);
    const addMessage = commands.find(
      (command): command is Extract<BridgeCommand, { type: 'add-message' }> =>
        command.type === 'add-message',
    );
    const session = await resolveBridgeSession(body);
    if (!addMessage) {
      await dispatchBridgeCommands(session, commands);
      await rememberSession(threadId, session);
      return stateResponse(session, request, turnId, 'direct');
    }

    const principalResolution = await resolveHarnessPrincipal();
    if (!principalResolution.ok) return principalResolution.response;
    const principal = principalResolution.principal;
    if (!configuredServiceTenantMatches(principal)) {
      return Response.json(
        {
          error: 'tenant_connector_unavailable',
          message: 'This signed-in tenant does not yet have a matching hosted ACP credential.',
        },
        { status: 403 },
      );
    }

    const displayText = commandText(addMessage, true);
    const explicitRoute = explicitRouteFromBody(body);
    if (!cohesiveTurnRoutingEnabled(principal.tenant)) {
      const directCommands = explicitRoute === 'research'
        ? await commandsWithResearch(commands, principal, request)
        : commands;
      await dispatchBridgeCommands(session, directCommands);
      await rememberSession(threadId, session);
      return stateResponse(session, request, turnId, 'direct');
    }

    const prelude = await routeTurn(displayText, principal, request, explicitRoute);
    const turnContext = toTurnContext(prelude);
    session.prepareTurn(displayText, turnContext);
    await rememberSession(threadId, session);
    const stream = createStateStream(session, request.signal);
    void continueCohesiveTurn(session, commands, principal, request, turnContext);
    const headers = streamHeaders();
    headers.set('x-commonplace-turn-id', turnId);
    headers.set('x-commonplace-turn-mode', 'cohesive');
    return new Response(stream, {
      status: 200,
      headers,
    });
  } catch (error) {
    const status =
      error instanceof BridgeCommandError || error instanceof TurnRouterIdentityError
        ? error.status
        : 502;
    const message =
      error instanceof Error ? error.message : 'The hosted Theorem ACP session is unavailable.';
    return Response.json({ error: 'console_chat_wire_failed', message }, { status });
  }
}

function stateResponse(
  session: AcquiredAcpSession,
  request: Request,
  turnId: string,
  mode: 'direct' | 'cohesive',
): Response {
  const headers = streamHeaders();
  headers.set('x-commonplace-turn-id', turnId);
  headers.set('x-commonplace-turn-mode', mode);
  return new Response(createStateStream(session, request.signal), { status: 200, headers });
}

async function rememberSession(
  threadId: string | null,
  session: AcquiredAcpSession,
): Promise<void> {
  const sessionId = session.getState().sessionId;
  if (!threadId || !sessionId) return;
  try {
    await updateThread(threadId, { sessionId });
  } catch {
    // Thread may not exist yet; the page creates it before send.
  }
}

async function continueCohesiveTurn(
  session: AcquiredAcpSession,
  commands: BridgeCommand[],
  principal: HarnessPrincipal,
  request: Request,
  turnContext: TurnContext,
): Promise<void> {
  try {
    const grounded = turnContext.route === 'research'
      ? await commandsWithResearch(commands, principal, request)
      : commands;
    const routed = grounded.map((command) =>
      command.type === 'add-message' ? { ...command, turnContext } : command,
    );
    await dispatchBridgeCommands(session, routed, { preparedTurn: true });
  } catch (error) {
    if (request.signal.aborted) {
      await session.cancel();
      return;
    }
    session.failPreparedTurn(
      error instanceof Error ? error.message : 'The cohesive turn could not continue.',
    );
  }
}

async function commandsWithResearch(
  commands: BridgeCommand[],
  principal: HarnessPrincipal,
  request: Request,
): Promise<BridgeCommand[]> {
  const addMessage = commands.find(
    (command): command is Extract<BridgeCommand, { type: 'add-message' }> =>
      command.type === 'add-message',
  );
  if (!addMessage) return commands;
  const capabilities = await loadInstanceCapabilities(principal);
  if (!capabilities.ok) throw new Error(await responseMessage(capabilities.response));
  if (!capabilities.capabilities.webSearch) {
    throw new Error('Web search is unavailable on this connected CommonPlace backend.');
  }
  const displayText = commandText(addMessage, true);
  const research = await loadWebResearch(displayText, principal, request);
  if (!research.ok) throw new Error(await responseMessage(research.response));
  const promptText = appendWebResearch(commandText(addMessage, false), research.sources);
  return commands.map((command) =>
    command === addMessage
      ? {
          ...command,
          message: { ...command.message, parts: [{ type: 'text', text: promptText }] },
        }
      : command,
  );
}

function commandText(
  command: Extract<BridgeCommand, { type: 'add-message' }>,
  display: boolean,
): string {
  const text = command.message.parts.map((part) => part.text).join('\n');
  return display ? command.displayText ?? text : text;
}

function explicitRouteFromBody(body: Record<string, unknown>): TurnRoute | undefined {
  const route = body.turnRoute;
  if (route === undefined || route === null || route === 'auto') return undefined;
  if (route === 'chat' || route === 'research' || route === 'agent') return route;
  throw new BridgeCommandError('turnRoute must be auto, chat, research, or agent.', 400);
}

async function responseMessage(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { message?: unknown } | null;
  return typeof payload?.message === 'string'
    ? payload.message
    : `The connected backend refused the request with status ${response.status}.`;
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
