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
import type { AcquiredAcpSession } from '@commonplace/theorem-acp/session-manager';
import { deltaStream, readChatRequest, requireMobileApiKey } from '@/lib/chat-delta';
import {
  configuredServiceTenantMatches,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';
import { loadInstanceCapabilities } from '@/lib/server/instance-capabilities';
import { loadWebResearch } from '@/lib/server/web-research';
import {
  explicitRouteForCapability,
  routeTurn,
  toTurnContext,
  TurnRouterIdentityError,
  type TurnPrelude,
} from '@/lib/server/turn-router';
import { appendWebResearch } from '@/lib/web-research-contract';
import type { HarnessPrincipal } from '@/lib/harness-principal-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type TurnOutcome = 'completed' | 'failed' | 'refused' | 'cancelled';

const ROUTER_FALLBACK_REASONS = new Set([
  'not_configured',
  'invalid_configuration',
  'provider_timeout',
  'provider_error',
  'malformed_output',
  'router_unreachable',
  'router_invalid_response',
]);

function elapsedMs(started: number): number {
  return Math.max(0, Math.round((performance.now() - started) * 100) / 100);
}

function safeFallbackReason(reason: string | null): string | undefined {
  if (!reason) return undefined;
  if (ROUTER_FALLBACK_REASONS.has(reason)) return reason;
  if (/^router_http_[1-5][0-9]{2}$/.test(reason)) return 'router_http_error';
  return 'unrecognized';
}

function recordTurnTelemetry(
  turnId: string,
  event: string,
  details: {
    readonly route?: TurnPrelude['route'];
    readonly duration_ms?: number;
    readonly fallback_reason?: string;
    readonly outcome?: TurnOutcome;
    readonly status?: number;
  } = {},
) {
  console.info(JSON.stringify({
    schema_version: 'commonplace-turn-telemetry/1',
    turn_id: turnId,
    event,
    ...details,
  }));
}

function cohesiveTurnRoutingEnabled(tenant: string): boolean {
  const configured = process.env.CONSOLE_COHESIVE_TURN_ROUTING?.trim();
  if (!configured || configured === 'off') return false;
  const admittedTenants = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return admittedTenants.includes('all') || admittedTenants.includes(tenant);
}

export async function POST(request: Request): Promise<Response> {
  const turnId = crypto.randomUUID();
  const requestStarted = performance.now();
  try {
    if (request.headers.has('x-api-key')) {
      requireMobileApiKey(request, process.env.CONSOLE_MOBILE_API_KEY);
    }
    const resolution = await resolveHarnessPrincipal();
    if (!resolution.ok) {
      if (resolution.response.status === 401 || resolution.response.status === 403) {
        recordTurnTelemetry(turnId, 'identity_refused', {
          duration_ms: elapsedMs(requestStarted),
          status: resolution.response.status,
        });
      }
      return resolution.response;
    }
    const principal = resolution.principal;
    if (!configuredServiceTenantMatches(principal)) {
      recordTurnTelemetry(turnId, 'identity_refused', {
        duration_ms: elapsedMs(requestStarted),
        status: 403,
      });
      return Response.json(
        {
          error: 'tenant_connector_unavailable',
          message: 'This signed-in tenant does not yet have a matching hosted ACP credential.',
        },
        { status: 403 },
      );
    }
    const chat = readChatRequest(await request.json().catch(() => null));
    if (!cohesiveTurnRoutingEnabled(principal.tenant)) {
      return directHostedTurn(request, principal, chat, turnId);
    }
    const routerStarted = performance.now();
    const prelude = await routeTurn(
      chat.displayText,
      principal,
      request,
      explicitRouteForCapability(chat.capability),
    );
    recordTurnTelemetry(turnId, 'router_completed', {
      route: prelude.route,
      duration_ms: elapsedMs(routerStarted),
      fallback_reason: safeFallbackReason(prelude.fallback_reason),
    });
    const headers = streamHeaders();
    headers.set('x-commonplace-turn-id', turnId);
    headers.set('x-commonplace-turn-mode', 'cohesive');
    return new Response(
      orchestratedTurnStream(request, principal, chat, prelude, turnId, requestStarted),
      { status: 200, headers },
    );
  } catch (error) {
    if (request.signal.aborted) {
      const cancelled = {
        duration_ms: elapsedMs(requestStarted),
        outcome: 'cancelled' as const,
        status: 499,
      };
      recordTurnTelemetry(turnId, 'turn_cancelled', cancelled);
      recordTurnTelemetry(turnId, 'turn_completed', cancelled);
      return Response.json(
        { error: 'turn_cancelled', message: 'The turn was cancelled.' },
        { status: 499 },
      );
    }
    const status =
      error instanceof BridgeCommandError || error instanceof TurnRouterIdentityError
        ? error.status
        : 502;
    recordTurnTelemetry(
      turnId,
      error instanceof TurnRouterIdentityError ? 'identity_refused' : 'request_failed',
      { duration_ms: elapsedMs(requestStarted), status },
    );
    const message =
      error instanceof Error ? error.message : 'The hosted Theorem ACP session is unavailable.';
    return Response.json({ error: 'console_chat_wire_failed', message }, { status });
  }
}

async function directHostedTurn(
  request: Request,
  principal: HarnessPrincipal,
  chat: ReturnType<typeof readChatRequest>,
  turnId: string,
): Promise<Response> {
  let promptText = chat.promptText;
  if (chat.capability?.kind === 'web') {
    const capabilities = await loadInstanceCapabilities(principal);
    if (!capabilities.ok) return capabilities.response;
    if (!capabilities.capabilities.webSearch) {
      return Response.json(
        {
          error: 'web_search_unavailable',
          message: 'Web search is unavailable on this connected CommonPlace backend.',
        },
        { status: 409 },
      );
    }
    const research = await loadWebResearch(chat.displayText, principal, request);
    if (!research.ok) return research.response;
    promptText = appendWebResearch(chat.promptText, research.sources);
  }
  const command: BridgeCommand = {
    type: 'add-message',
    message: { role: 'user', parts: [{ type: 'text', text: promptText }] },
    parentId: null,
    sourceId: null,
    displayText: chat.displayText,
  };
  const session = await resolveBridgeSession({});
  await dispatchBridgeCommands(session, [command]);
  const headers = streamHeaders();
  headers.set('x-commonplace-turn-id', turnId);
  headers.set('x-commonplace-turn-mode', 'direct');
  return new Response(
    deltaStream((listener) => session.subscribe(listener), session.getState(), request.signal),
    { status: 200, headers },
  );
}

function orchestratedTurnStream(
  request: Request,
  principal: HarnessPrincipal,
  chat: ReturnType<typeof readChatRequest>,
  prelude: TurnPrelude,
  turnId: string,
  requestStarted: number,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let session: AcquiredAcpSession | null = null;
      let closed = false;
      let terminalRecorded = false;
      let firstSubstantiveTokenRecorded = false;
      const recordTerminal = (outcome: TurnOutcome) => {
        if (terminalRecorded) return;
        terminalRecorded = true;
        recordTurnTelemetry(turnId, 'turn_completed', {
          route: prelude.route,
          duration_ms: elapsedMs(requestStarted),
          outcome,
        });
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };
      const write = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const cancel = () => {
        recordTurnTelemetry(turnId, 'turn_cancelled', {
          route: prelude.route,
          duration_ms: elapsedMs(requestStarted),
          outcome: 'cancelled',
        });
        recordTerminal('cancelled');
        void session?.cancel();
      };
      request.signal.addEventListener('abort', cancel, { once: true });
      write('turn_prelude', prelude);
      write('turn_receipt', {
        turn_id: turnId,
        stage: 'router_completed',
        route: prelude.route,
      });
      write('turn_receipt', {
        turn_id: turnId,
        stage: 'prelude_published',
        route: prelude.route,
      });
      recordTurnTelemetry(turnId, 'prelude_published', {
        route: prelude.route,
        duration_ms: elapsedMs(requestStarted),
        fallback_reason: safeFallbackReason(prelude.fallback_reason),
      });
      void (async () => {
        try {
          let promptText = chat.promptText;
          if (prelude.route === 'research') {
            const researchStarted = performance.now();
            recordTurnTelemetry(turnId, 'research_started', { route: prelude.route });
            const capabilities = await loadInstanceCapabilities(principal);
            if (!capabilities.ok) {
              recordTurnTelemetry(turnId, 'research_completed', {
                route: prelude.route,
                duration_ms: elapsedMs(researchStarted),
                outcome: 'failed',
              });
              throw new Error('The connected backend capabilities are unavailable.');
            }
            if (!capabilities.capabilities.webSearch) {
              recordTurnTelemetry(turnId, 'research_completed', {
                route: prelude.route,
                duration_ms: elapsedMs(researchStarted),
                outcome: 'refused',
              });
              throw new Error('Web search is unavailable on this connected CommonPlace backend.');
            }
            let research: Awaited<ReturnType<typeof loadWebResearch>>;
            try {
              research = await loadWebResearch(chat.displayText, principal, request);
            } catch (error) {
              recordTurnTelemetry(turnId, 'research_completed', {
                route: prelude.route,
                duration_ms: elapsedMs(researchStarted),
                outcome: request.signal.aborted ? 'cancelled' : 'failed',
              });
              throw error;
            }
            if (!research.ok) {
              recordTurnTelemetry(turnId, 'research_completed', {
                route: prelude.route,
                duration_ms: elapsedMs(researchStarted),
                outcome: 'failed',
              });
              const payload = await research.response.json().catch(() => null) as { message?: string } | null;
              throw new Error(payload?.message ?? 'Web research failed for this turn.');
            }
            recordTurnTelemetry(turnId, 'research_completed', {
              route: prelude.route,
              duration_ms: elapsedMs(researchStarted),
              outcome: 'completed',
            });
            promptText = appendWebResearch(chat.promptText, research.sources);
          }
          session = await resolveBridgeSession({});
          if (request.signal.aborted) throw new DOMException('Turn cancelled', 'AbortError');
          const command: BridgeCommand = {
            type: 'add-message',
            message: { role: 'user', parts: [{ type: 'text', text: promptText }] },
            parentId: null,
            sourceId: null,
            displayText: chat.displayText,
            turnContext: toTurnContext(prelude),
          };
          await dispatchBridgeCommands(session, [command]);
          recordTurnTelemetry(turnId, 'composed_run_started', {
            route: prelude.route,
            duration_ms: elapsedMs(requestStarted),
          });
          write('turn_receipt', {
            turn_id: turnId,
            stage: 'composed_run_started',
            route: prelude.route,
          });
          const stream = deltaStream(
            (listener) => session!.subscribe(listener),
            session.getState(),
            request.signal,
          );
          const reader = stream.getReader();
          const streamDecoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const frame = streamDecoder.decode(value, { stream: true });
            if (!firstSubstantiveTokenRecorded && frame.startsWith('data:')) {
              firstSubstantiveTokenRecorded = true;
              recordTurnTelemetry(turnId, 'first_substantive_token', {
                route: prelude.route,
                duration_ms: elapsedMs(requestStarted),
              });
              write('turn_receipt', {
                turn_id: turnId,
                stage: 'first_substantive_token',
                route: prelude.route,
              });
            }
            if (frame.startsWith('event: done')) {
              write('turn_receipt', {
                turn_id: turnId,
                stage: 'completion',
                route: prelude.route,
              });
            }
            if (!closed) controller.enqueue(value);
          }
          const status = session.getState().turnStatus;
          recordTerminal(
            status === 'failed'
              ? 'failed'
              : status === 'refused'
                ? 'refused'
                : status === 'cancelled'
                  ? 'cancelled'
                  : 'completed',
          );
        } catch (error) {
          if (!request.signal.aborted) {
            write('error', { error: error instanceof Error ? error.message : 'Turn failed.' });
            write('done', {});
            recordTerminal('failed');
          }
        } finally {
          request.signal.removeEventListener('abort', cancel);
          close();
        }
      })();
    },
  });
}
