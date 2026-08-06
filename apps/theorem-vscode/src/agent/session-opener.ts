// SOURCING: @commonplace/theorem-acp session-manager and hosted-client. The
// pack owns no ACP protocol code; this is the adapter to the IDE end.
/**
 * V6's session opener, split out so `extension.ts` can import it lazily.
 *
 * A window that never starts a session never loads the ACP client, which keeps
 * activation cheap in the web workbench where every byte is fetched.
 */

import type { TheoremPackConfig } from '../config';
import type { AcpSession, PermissionOutcome, PermissionRequest } from './presence';
import { forwardAgentMessageChunk } from './acp-chunks';

/**
 * Open the window's session.
 *
 * `workspaceRoot` is the cwd the agent runs relative to. `AgentPresence`
 * computes it from the first workspace folder and hands it down; an earlier
 * wiring dropped it here, which left every session rooted wherever the agent
 * process happened to start and made relative paths in a prompt meaningless.
 */
export async function openIdeSession(
  pack: TheoremPackConfig,
  workspaceRoot?: string,
): Promise<AcpSession> {
  const { HostedAcpClient } = await import('@commonplace/theorem-acp/hosted-client');

  const agentUrl = pack.agentUrl || pack.consoleOrigin;
  const token = pack.token;
  const cwd = workspaceRoot && workspaceRoot.length > 0 ? workspaceRoot : '/workspace/repo';

  const client = await HostedAcpClient.connect({
    agentId: 'theorem',
    cwd,
    url: toAcpWsUrl(agentUrl),
    token,
    ...(token
      ? {
          authRequest: new Request('http://localhost', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        }
      : {}),
  });

  await client.initialize(1);
  const sessionId = await client.newSession();

  return {
    sessionId,
    prompt: async (text, onDelta) => {
      const unsub = onDelta
        ? client.onSessionUpdate((notification) => {
            forwardAgentMessageChunk(sessionId, notification, onDelta);
          })
        : undefined;
      try {
        await client.prompt(sessionId, text);
      } finally {
        unsub?.();
      }
    },
    onPermissionRequest: (handler) => {
      client.onRequestPermission(async (request) => {
        const outcome = await handler(toIdePermission(request));
        return outcome.optionId === 'allow' || outcome.optionId === 'allow-once'
          ? 'allow'
          : 'reject';
      });
    },
    dispose: () => {
      void client.dispose();
    },
  };
}

function toAcpWsUrl(configured: string): string {
  const trimmed = configured.trim().replace(/\/$/, '');
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed.includes('/v1/commonplace/acp/ws')
      ? trimmed
      : `${trimmed}/v1/commonplace/acp/ws`;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const ws = trimmed.replace(/^http/, 'ws');
    return ws.includes('/v1/commonplace/acp/ws')
      ? ws
      : `${ws}/v1/commonplace/acp/ws`;
  }
  return trimmed;
}

function toIdePermission(request: {
  sessionId: string;
  toolCall: { toolCallId: string; title?: string };
}): PermissionRequest {
  return {
    requestId: request.toolCall.toolCallId,
    title: request.toolCall.title ?? 'Agent permission',
    detail: request.sessionId,
    options: [
      { id: 'allow', label: 'Allow' },
      { id: 'reject', label: 'Reject' },
    ],
  };
}

// Silence unused-import lint when PermissionOutcome is only used in types above.
export type { PermissionOutcome };
