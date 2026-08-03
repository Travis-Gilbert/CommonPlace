// SOURCING: vscode TimelineProvider API. The revision store is the workspace
// substrate's local history, reached over the console workspace route; no
// third-party history library applies.
/**
 * V3. Timeline and local history.
 *
 * Revisions from the workspace substrate land on VS Code's Timeline view with
 * timestamps and labels, diff between two revisions opens through the built-in
 * diff editor, and restore writes through `restoreRevision`.
 *
 * The spec's third acceptance clause is the design constraint: history is
 * correct with no git repository present. Nothing here reads git. The substrate
 * journals every write it sees, which is why a file that was never committed
 * still has a full history, and why a restore is itself a new revision rather
 * than a rewind.
 *
 * **`TimelineProvider` is proposed API, which the spec did not anticipate.**
 * Verified 2026-08-02: `src/vscode-dts/vscode.proposed.timeline.d.ts` is served
 * from microsoft/vscode main, and `TimelineProvider` appears nowhere in stable
 * `vscode.d.ts`. The Timeline *view* has been in stable VS Code for years, which
 * is what makes this easy to assume otherwise; the extension-facing provider
 * never finalized.
 *
 * So V3 takes V4's shape: the provider registers where the proposal is granted,
 * and everywhere else the same revisions are reachable through a quick pick
 * behind `theorem.showHistory`. The capability is present in stock VS Code,
 * code-server, and Cursor, as the extension-first law requires; only its
 * placement in the Timeline view is fork-gated.
 */

import * as vscode from 'vscode';
import type { IntelligenceDegradation } from '@commonplace/block-view-contracts/editor-intelligence';
import type { SubstrateClient } from '../substrate/client';

export const REVISIONS_QUERY = `query FileRevisions($uri: String!) {
  fileRevisions(uri: $uri) {
    generation
    revisions { id timestamp label size }
  }
}`;

export const REVISION_CONTENT_QUERY = `query RevisionContent($uri: String!, $revisionId: String!) {
  revisionContent(uri: $uri, revisionId: $revisionId) { revisionId text }
}`;

export const RESTORE_REVISION_MUTATION = `mutation RestoreRevision($uri: String!, $revisionId: String!) {
  restoreRevision(uri: $uri, revisionId: $revisionId) {
    receiptId
    objectId
    generation
  }
}`;

export interface Revision {
  readonly id: string;
  /** Epoch milliseconds. */
  readonly timestamp: number;
  /** What produced the revision: 'save', 'agent run', 'restore of <id>'. */
  readonly label: string;
  readonly size?: number;
}

interface RevisionsData {
  readonly fileRevisions: { readonly generation: number; readonly revisions: readonly Revision[] } | null;
}

interface RevisionContentData {
  readonly revisionContent: { readonly revisionId: string; readonly text: string } | null;
}

export const THEOREM_HISTORY_SCHEME = 'theorem-history';

/**
 * Read-only documents for revision bodies, so the diff editor has a left side.
 *
 * The revision id rides in the query string rather than the path: a path-only
 * encoding collides the moment a file name contains the separator, and the
 * diff editor shows the path to the reader.
 */
export class RevisionContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly client: SubstrateClient) {}

  static uriFor(target: vscode.Uri, revisionId: string): vscode.Uri {
    return target.with({ scheme: THEOREM_HISTORY_SCHEME, query: `revision=${revisionId}` });
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const revisionId = new URLSearchParams(uri.query).get('revision');
    if (!revisionId) return '';
    const target = uri.with({ scheme: 'file', query: '' });
    const result = await this.client.query<RevisionContentData>(REVISION_CONTENT_QUERY, {
      uri: target.toString(),
      revisionId,
    });
    if (!result.ok || !result.data.revisionContent) return '';
    return result.data.revisionContent.text;
  }
}

/**
 * Structural mirrors of the proposed timeline shapes.
 *
 * The pack compiles against stable `@types/vscode`, so the proposed d.ts is not
 * in scope. Copying its declarations in would make this repo track upstream
 * churn on an API it only feature-detects.
 */
export interface TimelineItemLike {
  label: string;
  timestamp: number;
  id?: string;
  detail?: string;
  contextValue?: string;
  command?: { command: string; title: string; arguments?: unknown[] };
}

export interface TimelineLike {
  readonly items: TimelineItemLike[];
}

export class TheoremTimelineProvider {
  readonly id = 'theorem.history';
  readonly label = 'Theorem local history';

  private readonly onDidChangeEmitter = new vscode.EventEmitter<{ uri: vscode.Uri; reset: boolean }>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly client: SubstrateClient) {}

  /** Called after a write so the view refreshes without the user re-opening it. */
  invalidate(uri: vscode.Uri): void {
    this.onDidChangeEmitter.fire({ uri, reset: true });
  }

  async provideTimeline(uri: vscode.Uri): Promise<TimelineLike> {
    const result = await this.client.query<RevisionsData>(
      REVISIONS_QUERY,
      { uri: uri.toString() },
      (data) => data.fileRevisions?.generation,
    );

    if (!result.ok || !result.data.fileRevisions) {
      // No silent empty history: an unreachable substrate says so in the view.
      return { items: [unavailableItem(uri, result.ok ? undefined : result.degradation)] };
    }

    const items = [...result.data.fileRevisions.revisions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((revision) => toTimelineItem(uri, revision));
    return { items };
  }
}

export function toTimelineItem(uri: vscode.Uri, revision: Revision): TimelineItemLike {
  const item: TimelineItemLike = {
    label: revision.label,
    timestamp: revision.timestamp,
    id: revision.id,
    contextValue: 'theorem.revision',
    command: {
      command: 'theorem.diffRevision',
      title: 'Compare with current',
      arguments: [uri, revision.id],
    },
  };
  if (revision.size !== undefined) item.detail = `${revision.size} bytes`;
  return item;
}

function unavailableItem(uri: vscode.Uri, degradation?: IntelligenceDegradation): TimelineItemLike {
  return {
    label: 'Local history unavailable',
    timestamp: 0,
    id: `theorem.history.unavailable:${uri.toString()}`,
    detail: degradation?.detail ?? 'The workspace substrate did not answer.',
  };
}

/** Whether this build granted the timeline proposal. Same test as V4's gate. */
export function timelineProposalGranted(api: typeof vscode = vscode): boolean {
  return (
    typeof (api.workspace as unknown as Record<string, unknown>).registerTimelineProvider ===
    'function'
  );
}

/**
 * Register the provider where the proposal exists.
 *
 * Returns an empty array otherwise, and the caller wires `theorem.showHistory`
 * instead, so the revisions stay reachable on stable API.
 */
export function registerTimeline(
  provider: TheoremTimelineProvider,
  api: typeof vscode = vscode,
): vscode.Disposable[] {
  if (!timelineProposalGranted(api)) return [];
  const workspace = api.workspace as unknown as {
    registerTimelineProvider(scheme: string[], provider: unknown): vscode.Disposable;
  };
  return [workspace.registerTimelineProvider(['file'], provider)];
}

/**
 * The stable-host path: pick a revision, then compare it with the current file.
 *
 * Reachable everywhere, including in a build that also has the Timeline view, so
 * there is one code path to keep correct rather than two behaviours to reconcile.
 */
export async function showHistoryQuickPick(
  provider: TheoremTimelineProvider,
  uri: vscode.Uri,
  api: typeof vscode = vscode,
): Promise<void> {
  const timeline = await provider.provideTimeline(uri);
  const picked = await api.window.showQuickPick(
    timeline.items.map((item) => ({
      label: item.label,
      description: item.timestamp ? new Date(item.timestamp).toISOString() : item.detail,
      id: item.id,
      runnable: item.command !== undefined,
    })),
    { title: 'Theorem local history' },
  );
  if (!picked?.runnable || !picked.id) return;
  await api.commands.executeCommand('theorem.diffRevision', uri, picked.id);
}
