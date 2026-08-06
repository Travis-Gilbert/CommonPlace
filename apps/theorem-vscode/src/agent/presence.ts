// SOURCING: @commonplace/theorem-acp (session-manager, bridge, identity) is the
// ACP client this repo already ships; the pack wraps it. Verify-first decision
// VF3: ship thin rather than adopt a third-party ACP extension, whose config
// surface and identity path we would not own.
/**
 * V6. Agent presence.
 *
 * Theorem attached over ACP inside the surface: sessions start from the IDE,
 * permission prompts round-trip in the IDE, and runs and receipts deep-link to
 * the console.
 *
 * The pack owns no protocol code. `packages/theorem-acp` already holds the
 * client, the hosted client, the session manager, session boot, identity, and
 * the bridge command surface; this module is the VS Code end of those, which is
 * a webview for the conversation and a permission prompt rendered as a modal.
 */

import * as vscode from 'vscode';

/** Console origin the deep links point at, e.g. https://console.example. */
export interface PresenceConfig {
  readonly consoleOrigin: string;
}

/** The subset of the ACP session surface the IDE end drives. */
export interface AcpSession {
  readonly sessionId: string;
  /**
   * Send one user turn. When `onDelta` is provided, agent_message_chunk text
   * from session/update notifications is forwarded as it arrives.
   */
  prompt(text: string, onDelta?: (chunk: string) => void): Promise<void>;
  onPermissionRequest(handler: (request: PermissionRequest) => Promise<PermissionOutcome>): void;
  dispose(): void;
}

export interface PermissionRequest {
  readonly requestId: string;
  readonly title: string;
  readonly detail?: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
}

export interface PermissionOutcome {
  readonly requestId: string;
  readonly optionId: string;
}

export interface SessionOpener {
  open(workspaceRoot: string | undefined): Promise<AcpSession>;
}

/**
 * Deep link to a run in the console.
 *
 * The console owns run presentation; duplicating it in a webview would fork the
 * surface that receipts are read on. `vscode.env.openExternal` also works in
 * the web workbench, where a desktop-only shell-open would not.
 */
export function runLink(config: PresenceConfig, runId: string): vscode.Uri {
  return vscode.Uri.parse(`${config.consoleOrigin.replace(/\/$/, '')}/runs/${runId}`);
}

export class AgentPresence implements vscode.Disposable {
  private session: AcpSession | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly config: PresenceConfig,
    private readonly opener: SessionOpener,
  ) {}

  /** Start (or reuse) the window's session. */
  async start(): Promise<AcpSession> {
    if (this.session) return this.session;
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const session = await this.opener.open(root);
    session.onPermissionRequest((request) => this.askPermission(request));
    this.session = session;
    return session;
  }

  /** Send the active selection into the session. The composer half of V2. */
  async sendSelection(uri: vscode.Uri, range: vscode.Range): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const text = document.getText(range);
    const session = await this.start();
    await session.prompt(`${uri.toString()}\n\n${text}`);
  }

  /**
   * Round-trip a permission prompt inside the IDE.
   *
   * Modal, because a permission prompt that can be missed is a permission
   * prompt that gets answered by timeout. Dismissal is not consent: with no
   * choice made, the first option is never assumed, and the last option (the
   * conventional refusal) is returned.
   */
  async askPermission(request: PermissionRequest): Promise<PermissionOutcome> {
    const picked = await vscode.window.showInformationMessage(
      request.title,
      { modal: true, detail: request.detail },
      ...request.options.map((option) => option.label),
    );
    const match = request.options.find((option) => option.label === picked);
    return {
      requestId: request.requestId,
      optionId: match?.id ?? request.options[request.options.length - 1]?.id ?? 'reject',
    };
  }

  async openRun(runId: string): Promise<boolean> {
    return vscode.env.openExternal(runLink(this.config, runId));
  }

  dispose(): void {
    this.session?.dispose();
    this.session = undefined;
    for (const disposable of this.disposables) disposable.dispose();
  }
}
