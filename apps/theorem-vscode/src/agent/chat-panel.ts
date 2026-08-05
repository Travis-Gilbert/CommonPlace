// SOURCING: @commonplace/theorem-chat-register (webview HTML + session
// controller) and @commonplace/theorem-acp via session-opener. SPEC-THEOREM-
// CHAT-REGISTER-1.0 CR-005 Studio mount.
import * as vscode from 'vscode';
import { createChatSessionController } from '@commonplace/theorem-chat-register/session';
import { renderTheoremChatWebviewHtml } from '@commonplace/theorem-chat-register/webview-html';
import type { ChatTransport } from '@commonplace/theorem-chat-register/transport';
import type { TheoremPackConfig } from '../config';
import type { AcpSession } from './presence';

export class TheoremChatPanel {
  public static readonly viewType = 'theorem.chat';

  private panel: vscode.WebviewPanel | undefined;
  private controller: ReturnType<typeof createChatSessionController> | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly pack: TheoremPackConfig,
    private readonly openSession: (workspaceRoot: string | undefined) => Promise<AcpSession>,
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      TheoremChatPanel.viewType,
      'Theorem Chat',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel = panel;
    const nonce = String(Date.now());
    panel.webview.html = renderTheoremChatWebviewHtml({
      nonce,
      cspSource: panel.webview.cspSource,
    });

    const transport = this.createTransport();
    const controller = createChatSessionController(transport);
    this.controller = controller;

    const push = () => {
      void panel.webview.postMessage({
        type: 'snapshot',
        snapshot: controller.getSnapshot(),
      });
    };
    const unsub = controller.subscribe(() => push());

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === 'ready') {
        try {
          await controller.open();
        } catch (error) {
          void vscode.window.showErrorMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
        push();
        return;
      }
      if (message?.type === 'prompt' && typeof message.text === 'string') {
        try {
          await controller.prompt(message.text);
        } catch {
          // Snapshot carries error.
        }
        push();
      }
    });

    panel.onDidDispose(() => {
      unsub();
      controller.dispose();
      this.controller = undefined;
      this.panel = undefined;
    });
  }

  private createTransport(): ChatTransport {
    let session: AcpSession | undefined;
    return {
      openSession: async () => {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        session = await this.openSession(root);
        return session.sessionId;
      },
      prompt: async (_sessionId, text, onDelta) => {
        if (!session) throw new Error('theorem.chat: no ACP session');
        await session.prompt(text);
        onDelta('Turn submitted over Theorem ACP.');
      },
      dispose: () => {
        session?.dispose();
        session = undefined;
      },
    };
  }
}
