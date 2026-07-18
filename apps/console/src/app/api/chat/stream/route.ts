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
import { deltaStream, readChatRequest, requireMobileApiKey } from '@/lib/chat-delta';
import {
  configuredServiceTenantMatches,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';
import { loadInstanceCapabilities } from '@/lib/server/instance-capabilities';
import type { HarnessPrincipal } from '@/lib/harness-principal-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    let principal: HarnessPrincipal | null = null;
    const configuredMobileKey = process.env.CONSOLE_MOBILE_API_KEY?.trim();
    const mobileCredential = configuredMobileKey
      ? request.headers.get('x-api-key') === configuredMobileKey
      : false;
    if (request.headers.has('x-api-key')) {
      requireMobileApiKey(request, process.env.CONSOLE_MOBILE_API_KEY);
    }
    if (!mobileCredential) {
      const resolution = await resolveHarnessPrincipal();
      if (!resolution.ok) return resolution.response;
      principal = resolution.principal;
      if (!configuredServiceTenantMatches(resolution.principal)) {
        return Response.json(
          {
            error: 'tenant_connector_unavailable',
            message: 'This signed-in tenant does not yet have a matching hosted ACP credential.',
          },
          { status: 403 },
        );
      }
    }
    const chat = readChatRequest(await request.json().catch(() => null));
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
    }
    const command: BridgeCommand = {
      type: 'add-message',
      message: { role: 'user', parts: [{ type: 'text', text: chat.promptText }] },
      parentId: null,
      sourceId: null,
      displayText: chat.displayText,
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
