// SOURCING: vscode TimelineProvider API. The revision store is the workspace
// substrate's local history, reached over `fileHistory`; no third-party history
// library applies.
/**
 * V3. Timeline and local history.
 *
 * Revisions from the workspace substrate land on VS Code's Timeline view with
 * timestamps and labels, diff between a revision and the current file opens
 * through the built-in diff editor, and restore writes through
 * `restoreRevision`.
 *
 * The spec's third acceptance clause is the design constraint: history is
 * correct with no git repository present. Nothing here reads git. The substrate
 * journals every write it sees, which is why a file that was never committed
 * still has a full history, and why a restore is itself a new revision rather
 * than a rewind.
 *
 * **Revisions are keyed by generation.** There is no separate revision id on
 * this surface: `restoreRevision(path, generation)` addresses the same monotonic
 * stamp every other query carries, and `pinnedVfsGeneration` filters the history
 * to that stamp and below. An earlier build of this module invented a revision
 * id, which would have had to be mapped back to a generation at every call.
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
import type {
  FileHistory,
  FileRevision,
  UnavailableSurface,
} from '@commonplace/block-view-contracts/editor-intelligence';
import {
  FILE_HISTORY_QUERY,
  FILE_REVISION_CONTENT_QUERY,
  RESTORE_REVISION_MUTATION,
} from '@commonplace/block-view-contracts/editor-intelligence';
import type { SubstrateClient } from '../substrate/client';

interface FileHistoryData {
  readonly fileHistory: FileHistory | null;
}

interface RestoreData {
  readonly restoreRevision: FileHistory | null;
}

export const THEOREM_HISTORY_SCHEME = 'theorem-history';

/**
 * Read-only documents for revision bodies, so the diff editor has a left side.
 *
 * The generation rides in the query string rather than the path: a path-only
 * encoding collides the moment a file name contains the separator, and the
 * diff editor shows the path to the reader.
 */
export class RevisionContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly client: SubstrateClient) {}

  static uriFor(target: vscode.Uri, generation: number): vscode.Uri {
    return target.with({ scheme: THEOREM_HISTORY_SCHEME, query: `generation=${generation}` });
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const raw = new URLSearchParams(uri.query).get('generation');
    const generation = raw === null ? Number.NaN : Number(raw);
    if (!Number.isSafeInteger(generation)) return '';
    const target = uri.with({ scheme: 'file', query: '' });
    const result = await this.client.query<FileHistoryData>(FILE_REVISION_CONTENT_QUERY, {
      path: target.fsPath,
      generation,
    });
    if (!result.ok || !result.data.fileHistory) return '';
    const revision = result.data.fileHistory.revisions.find(
      (candidate) => candidate.generation === generation,
    );
    // A revision whose body exceeded the server's inline limit answers with no
    // content. Empty is honest here; the diff shows an empty left side rather
    // than a body invented from the current file.
    return revision?.content ?? '';
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
    const result = await this.client.query<FileHistoryData>(FILE_HISTORY_QUERY, {
      path: uri.fsPath,
    });

    if (!result.ok || !result.data.fileHistory) {
      // No silent empty history: an unreachable substrate says so in the view.
      return { items: [unavailableItem(uri, result.ok ? undefined : result.degradation)] };
    }

    const items = [...result.data.fileHistory.revisions]
      .sort((a, b) => b.generation - a.generation)
      .map((revision) => toTimelineItem(uri, revision));
    return { items };
  }

  /**
   * Restore one revision. The write is the server's, and it produces a new
   * revision rather than rewinding, so the returned history already contains it.
   */
  async restore(uri: vscode.Uri, generation: number): Promise<FileHistory | UnavailableSurface> {
    const result = await this.client.query<RestoreData>(RESTORE_REVISION_MUTATION, {
      path: uri.fsPath,
      generation,
    });
    if (!result.ok) return result.degradation;
    if (!result.data.restoreRevision) {
      return { level: 'unavailable', code: 'editor_history_unavailable', detail: uri.fsPath };
    }
    this.invalidate(uri);
    return result.data.restoreRevision;
  }
}

export function toTimelineItem(uri: vscode.Uri, revision: FileRevision): TimelineItemLike {
  const item: TimelineItemLike = {
    label: revision.label ?? `Revision ${revision.generation}`,
    timestamp: revision.timestampMs,
    id: String(revision.generation),
    contextValue: 'theorem.revision',
    command: {
      command: 'theorem.diffRevision',
      title: 'Compare with current',
      arguments: [uri, revision.generation],
    },
  };
  item.detail = revision.hash;
  return item;
}

function unavailableItem(uri: vscode.Uri, degradation?: UnavailableSurface): TimelineItemLike {
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
  if (!picked?.runnable || picked.id === undefined) return;
  await api.commands.executeCommand('theorem.diffRevision', uri, Number(picked.id));
}
