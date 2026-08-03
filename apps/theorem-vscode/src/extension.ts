// SOURCING: vscode extension API only. Activation wiring, no logic of its own
// beyond the gate decisions the deliverables define.
/**
 * The Theorem pack's entry point.
 *
 * Extension-first law: everything registered here runs in stock VS Code,
 * code-server, and Cursor. The one gated capability is V4 search, and it gates
 * on feature detection rather than on a build flag, so the same VSIX behaves
 * correctly in a granting and a non-granting host.
 */

import * as vscode from 'vscode';
import { SubstrateClient } from './substrate/client';
import {
  IntelligenceSurface,
  SEMANTIC_LEGEND,
  TheoremCodeActionProvider,
  TheoremInlayHintProvider,
  TheoremTokenProvider,
} from './intelligence/surface';
import { readableDegradation } from './degradation';
import {
  RevisionContentProvider,
  RESTORE_REVISION_MUTATION,
  THEOREM_HISTORY_SCHEME,
  TheoremTimelineProvider,
  registerTimeline,
  showHistoryQuickPick,
  timelineProposalGranted,
} from './timeline/history';
import { registerSpineSearch, searchProposalGranted } from './search/spine';
import { THEOREM_SCHEME, TheoremFileSystemProvider } from './fs/theorem-fs';
import { AgentPresence } from './agent/presence';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Theorem');
  const config = vscode.workspace.getConfiguration('theorem');

  const client = new SubstrateClient({
    endpoint: {
      graphqlUrl: config.get<string>('graphqlUrl', 'http://127.0.0.1:8787/graphql'),
      changefeedUrl: config.get<string>('changefeedUrl') || undefined,
      token: config.get<string>('token') || undefined,
    },
    EventSourceImpl: globalThis.EventSource as never,
    log: (message) => output.appendLine(message),
    onChangefeedStatus: (status) => output.appendLine(`changefeed: ${status}`),
  });
  context.subscriptions.push({ dispose: () => client.dispose() });

  // V2.
  const surface = new IntelligenceSurface(client);
  context.subscriptions.push(surface);
  surface.watchReadiness();
  for (const document of vscode.workspace.textDocuments) surface.watch(document.uri);
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => surface.watch(document.uri)),
    vscode.workspace.onDidCloseTextDocument((document) => surface.unwatch(document.uri)),
    vscode.languages.registerDocumentSemanticTokensProvider(
      { scheme: '*' },
      new TheoremTokenProvider(surface),
      SEMANTIC_LEGEND,
    ),
    vscode.languages.registerInlayHintsProvider({ scheme: '*' }, new TheoremInlayHintProvider(surface)),
    vscode.languages.registerCodeActionsProvider({ scheme: '*' }, new TheoremCodeActionProvider(surface)),
  );

  // V3, gated on the timeline proposal. Where it is absent the same revisions
  // are reachable through theorem.showHistory, registered below.
  const timeline = new TheoremTimelineProvider(client);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      THEOREM_HISTORY_SCHEME,
      new RevisionContentProvider(client),
    ),
    ...registerTimeline(timeline),
  );
  output.appendLine(
    timelineProposalGranted()
      ? 'history: on the Timeline view'
      : 'history: this build did not grant the timeline proposal; use Theorem: Show History.',
  );

  // V5.
  const graphFs = new TheoremFileSystemProvider(client);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(THEOREM_SCHEME, graphFs, { isCaseSensitive: true }),
  );

  // V6.
  const presence = new AgentPresence(
    { consoleOrigin: config.get<string>('consoleOrigin', 'http://127.0.0.1:3000') },
    {
      // The session opener is injected so the pack can be driven by the hosted
      // client or the local one without this file knowing which.
      open: async () => {
        const { openIdeSession } = await import('./agent/session-opener');
        return openIdeSession(config);
      },
    },
  );
  context.subscriptions.push(presence);

  // V4, gated. Nothing registered means VS Code's ripgrep search is untouched.
  const roots = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.toString());
  if (searchProposalGranted()) {
    context.subscriptions.push(
      ...registerSpineSearch({
        client,
        roots,
        onDegradation: (degradation) => output.appendLine(readableDegradation(degradation)),
      }),
    );
    output.appendLine('search: bound to the index spine');
  } else {
    output.appendLine(
      'search: this build did not grant fileSearchProvider2/textSearchProvider2; ripgrep stands.',
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('theorem.applyFix', async (uri: vscode.Uri, fixId: string) => {
      const outcome = await surface.applyFix(uri, fixId);
      if ('level' in outcome) {
        void vscode.window.showWarningMessage(readableDegradation(outcome));
        return;
      }
      // No edit here on purpose: the buffer changes when the file change event
      // arrives. Named choice 9.
      output.appendLine(`applyFix ${fixId}: ${outcome.edits.length} edit(s) written through the seam`);
    }),
    vscode.commands.registerCommand(
      'theorem.sendSelectionToComposer',
      (uri: vscode.Uri, range: vscode.Range) => presence.sendSelection(uri, range),
    ),
    vscode.commands.registerCommand(
      'theorem.saveSelectionToGraph',
      async (uri: vscode.Uri, range: vscode.Range) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const target = vscode.Uri.parse(`${THEOREM_SCHEME}://object/selection-${Date.now()}.md`);
        await graphFs.writeFile(target, Buffer.from(document.getText(range), 'utf8'));
        void vscode.window.showTextDocument(target);
      },
    ),
    vscode.commands.registerCommand('theorem.startSession', () => presence.start()),
    vscode.commands.registerCommand('theorem.showHistory', async (target?: vscode.Uri) => {
      const uri = target ?? vscode.window.activeTextEditor?.document.uri;
      if (uri) await showHistoryQuickPick(timeline, uri);
    }),
    vscode.commands.registerCommand('theorem.openRun', (runId: string) => presence.openRun(runId)),
    vscode.commands.registerCommand(
      'theorem.diffRevision',
      async (uri: vscode.Uri, revisionId: string) => {
        await vscode.commands.executeCommand(
          'vscode.diff',
          RevisionContentProvider.uriFor(uri, revisionId),
          uri,
          `${revisionId} ↔ current`,
        );
      },
    ),
    vscode.commands.registerCommand(
      'theorem.restoreRevision',
      async (uri: vscode.Uri, revisionId: string) => {
        const result = await client.query(RESTORE_REVISION_MUTATION, {
          uri: uri.toString(),
          revisionId,
        });
        if (!result.ok) {
          void vscode.window.showWarningMessage(readableDegradation(result.degradation));
          return;
        }
        timeline.invalidate(uri);
      },
    ),
  );
}

export function deactivate(): void {
  // Everything hangs off context.subscriptions.
}
