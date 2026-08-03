// SOURCING: vscode extension API only. Activation wiring, no logic of its own
// beyond the gate decisions the deliverables define.
/**
 * The Theorem pack's entry point.
 *
 * Extension-first law: everything registered here runs in stock VS Code,
 * code-server, and Cursor. The two gated capabilities are V4 search and V3's
 * Timeline placement, and both gate on feature detection rather than on a build
 * flag, so the same VSIX behaves correctly in a granting and a non-granting
 * host.
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
import { isConcurrencyRefusal } from '@commonplace/block-view-contracts/editor-intelligence';
import { readableReduced, readableUnavailable } from './degradation';
import {
  RevisionContentProvider,
  THEOREM_HISTORY_SCHEME,
  TheoremTimelineProvider,
  registerTimeline,
  showHistoryQuickPick,
  timelineProposalGranted,
} from './timeline/history';
import { registerSpineSearch, searchProposalGranted } from './search/spine';
import { THEOREM_SCHEME, TheoremFileSystemProvider, saveSelectionToGraph } from './fs/theorem-fs';
import { AgentPresence } from './agent/presence';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Theorem');
  const config = vscode.workspace.getConfiguration('theorem');

  const client = new SubstrateClient({
    endpoint: {
      graphqlUrl: config.get<string>('graphqlUrl', 'http://127.0.0.1:8787/graphql'),
      invalidationsUrl: config.get<string>('invalidationsUrl') || undefined,
      projectId: config.get<string>('projectId') || undefined,
      token: config.get<string>('token') || undefined,
    },
    EventSourceImpl: globalThis.EventSource as never,
    log: (message) => output.appendLine(message),
    onChangefeedStatus: (status) => output.appendLine(`invalidations: ${status}`),
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
    // Intentions are the one caret-local surface, so they refresh when the
    // caret moves rather than riding the standing query and re-querying the
    // whole file on every cursor keystroke.
    vscode.window.onDidChangeTextEditorSelection((event) => {
      void surface.refreshIntentions(event.textEditor.document, event.selections[0]?.active
        ?? new vscode.Position(0, 0));
    }),
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
      open: async (workspaceRoot) => {
        const { openIdeSession } = await import('./agent/session-opener');
        return openIdeSession(config, workspaceRoot);
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
        onDegradation: (degradation) =>
          output.appendLine(
            degradation.level === 'reduced'
              ? readableReduced(degradation.missingIndexes) ?? 'search: answered from part of the spine'
              : readableUnavailable(degradation),
          ),
      }),
    );
    output.appendLine('search: bound to the index spine');
  } else {
    output.appendLine(
      'search: this build did not grant fileSearchProvider2/textSearchProvider2; ripgrep stands.',
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('theorem.applyFix', async (_uri: vscode.Uri, fixId: string) => {
      const outcome = await surface.applyFix(fixId);
      if ('level' in outcome) {
        void vscode.window.showWarningMessage(readableUnavailable(outcome));
        return;
      }
      if (isConcurrencyRefusal(outcome)) {
        // The file moved between preparing the fix and applying it. Nothing was
        // written, and the correct next step is to re-read, which the standing
        // query does on its own once the invalidation lands.
        void vscode.window.showWarningMessage(outcome.message);
        return;
      }
      // No edit here on purpose: the buffer changes when the file change event
      // arrives. Named choice 9.
      output.appendLine(
        `applyFix ${fixId}: ${outcome.edits.length} edit(s) written at generation ${outcome.appliedGeneration}`,
      );
    }),
    vscode.commands.registerCommand(
      'theorem.sendSelectionToComposer',
      (uri: vscode.Uri, range: vscode.Range) => presence.sendSelection(uri, range),
    ),
    vscode.commands.registerCommand(
      'theorem.saveSelectionToGraph',
      async (uri: vscode.Uri, range: vscode.Range) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const title = `${vscode.workspace.asRelativePath(uri)}:${range.start.line + 1}`;
        const outcome = await saveSelectionToGraph(client, title, document.getText(range));
        if ('level' in outcome) {
          void vscode.window.showWarningMessage(readableUnavailable(outcome));
          return;
        }
        void vscode.window.showTextDocument(
          vscode.Uri.parse(`${THEOREM_SCHEME}://item/${outcome.id}.md`),
        );
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
      async (uri: vscode.Uri, generation: number) => {
        await vscode.commands.executeCommand(
          'vscode.diff',
          RevisionContentProvider.uriFor(uri, generation),
          uri,
          `Generation ${generation} ↔ current`,
        );
      },
    ),
    vscode.commands.registerCommand(
      'theorem.restoreRevision',
      async (uri: vscode.Uri, generation: number) => {
        const outcome = await timeline.restore(uri, generation);
        if ('level' in outcome) {
          void vscode.window.showWarningMessage(readableUnavailable(outcome));
          return;
        }
        output.appendLine(
          `restoreRevision ${uri.fsPath}@${generation}: history now has ${outcome.revisions.length} revision(s)`,
        );
      },
    ),
  );
}

export function deactivate(): void {
  // Everything hangs off context.subscriptions.
}
