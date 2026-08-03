// SOURCING: @commonplace/theorem-acp session-manager and hosted-client. The
// pack owns no ACP protocol code; this is the adapter to the IDE end.
/**
 * V6's session opener, split out so `extension.ts` can import it lazily.
 *
 * A window that never starts a session never loads the ACP client, which keeps
 * activation cheap in the web workbench where every byte is fetched.
 */

import type { WorkspaceConfiguration } from 'vscode';
import type { AcpSession, PermissionOutcome, PermissionRequest } from './presence';

/** The hosted client's session handle, narrowed to what the IDE end drives. */
interface HostedSession {
  readonly sessionId: string;
  prompt(text: string): Promise<void>;
  onPermissionRequest?(handler: (request: PermissionRequest) => Promise<PermissionOutcome>): void;
  close?(): void;
}

export async function openIdeSession(config: WorkspaceConfiguration): Promise<AcpSession> {
  // Through `unknown`: the hosted client's exported surface is wider and older
  // than the four calls the IDE end makes, and pinning its full type here would
  // couple the pack to changes it does not consume.
  const { createHostedAcpClient } = (await import(
    '@commonplace/theorem-acp/hosted-client'
  )) as unknown as {
    createHostedAcpClient(options: {
      baseUrl: string;
      token?: string;
    }): { openSession(cwd?: string): Promise<HostedSession> };
  };

  const client = createHostedAcpClient({
    baseUrl: config.get<string>('agentUrl', config.get<string>('consoleOrigin', 'http://127.0.0.1:3000')),
    token: config.get<string>('token') || undefined,
  });

  const session = await client.openSession();
  return {
    sessionId: session.sessionId,
    prompt: (text) => session.prompt(text),
    onPermissionRequest: (handler) => session.onPermissionRequest?.(handler),
    dispose: () => session.close?.(),
  };
}
