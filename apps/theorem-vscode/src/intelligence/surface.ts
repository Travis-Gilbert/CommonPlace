// SOURCING: vscode extension API (diagnostics, semantic tokens, inlay hints,
// code actions, language status). No third-party library sits between the pack
// and the API; the contract types come from @commonplace/block-view-contracts.
/**
 * V2. Intelligence providers.
 *
 * Diagnostic graph nodes become a DiagnosticCollection, spans become semantic
 * tokens, hints become inlay hints, intentions become code actions at the
 * caret, and readiness becomes a language status item plus a status bar chip.
 * Everything reads one standing query per open document through the V1 client,
 * so a background store mutation repaints the editor with no interaction.
 *
 * Two rules from the spec are enforced here rather than documented:
 *
 * - Named choice 9, fix application stays watch-confirmed. `applyFix` previews,
 *   writes through the VFS seam, and then *stops*. The buffer changes when the
 *   file change event arrives. Nothing optimistically edits the document, so a
 *   write that the seam rejected can never leave a lying buffer behind.
 * - Named choice 6, the typing-latency law is inherited. Every provider here
 *   answers from the last delivered snapshot, held in memory. No provider awaits
 *   the network inside a provideX call, so a slow substrate cannot make the
 *   editor's own render path wait on it.
 */

import * as vscode from 'vscode';
import type {
  EditorDiagnostic,
  FileIntelligence,
  FixPreview,
  IntelligenceDegradation,
  Position as ContractPosition,
  Range as ContractRange,
  ReadinessState,
  SemanticTokenSpan,
} from '@commonplace/block-view-contracts/editor-intelligence';
import {
  EDITOR_APPLY_FIX_MUTATION,
  EDITOR_INTELLIGENCE_QUERY,
  EDITOR_READINESS_QUERY,
} from '@commonplace/block-view-contracts/editor-intelligence';
import type { SubstrateClient, SubstrateResult } from '../substrate/client';
import { readableDegradation } from '../degradation';

/** Legend order is the wire order; index encoding stays inside this module. */
export const TOKEN_TYPES = [
  'namespace',
  'type',
  'class',
  'interface',
  'function',
  'method',
  'property',
  'variable',
  'parameter',
] as const;

export const TOKEN_MODIFIERS = [
  'declaration',
  'definition',
  'readonly',
  'static',
  'deprecated',
  'exported',
] as const;

export const SEMANTIC_LEGEND = new vscode.SemanticTokensLegend(
  [...TOKEN_TYPES],
  [...TOKEN_MODIFIERS],
);

export function toRange(range: ContractRange): vscode.Range {
  return new vscode.Range(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character,
  );
}

export function toPosition(position: ContractPosition): vscode.Position {
  return new vscode.Position(position.line, position.character);
}

const SEVERITY: Record<EditorDiagnostic['severity'], vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint,
};

export function toDiagnostic(finding: EditorDiagnostic): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    toRange(finding.range),
    finding.message,
    SEVERITY[finding.severity],
  );
  diagnostic.source = finding.source;
  diagnostic.code = finding.id;
  return diagnostic;
}

/**
 * Encode spans into VS Code's delta-packed token format.
 *
 * The builder wants tokens in document order; the store is free to answer in
 * any order, so sort before building rather than trusting the wire.
 */
export function buildTokens(spans: readonly SemanticTokenSpan[]): vscode.SemanticTokens {
  const builder = new vscode.SemanticTokensBuilder(SEMANTIC_LEGEND);
  const ordered = [...spans].sort(
    (a, b) => a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character,
  );
  for (const span of ordered) {
    if (!(TOKEN_TYPES as readonly string[]).includes(span.type)) continue;
    builder.push(toRange(span.range), span.type, span.modifiers ? [...span.modifiers] : []);
  }
  return builder.build();
}

interface IntelligenceQueryData {
  readonly fileIntelligence: FileIntelligence | null;
}

interface ReadinessQueryData {
  readonly editorReadiness: ReadinessState;
}

interface ApplyFixData {
  readonly applyFix: FixPreview | null;
}

/** What the providers render for one document, plus why it may be partial. */
export interface DocumentSnapshot {
  readonly intelligence?: FileIntelligence;
  readonly degradation?: IntelligenceDegradation;
}

export class IntelligenceSurface implements vscode.Disposable {
  private readonly diagnostics = vscode.languages.createDiagnosticCollection('theorem');
  private readonly snapshots = new Map<string, DocumentSnapshot>();
  private readonly subscriptions = new Map<string, () => void>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  private readonly statusItem: vscode.LanguageStatusItem;
  private readonly statusBar: vscode.StatusBarItem;
  private readiness: ReadinessState | undefined;

  /** Fires when a snapshot lands, so token and hint providers re-ask. */
  readonly onDidChangeIntelligence = this.onDidChangeEmitter.event;

  constructor(private readonly client: SubstrateClient) {
    this.statusItem = vscode.languages.createLanguageStatusItem('theorem.readiness', {
      scheme: '*',
    });
    this.statusItem.name = 'Theorem';
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBar.name = 'Theorem readiness';
    this.renderReadiness();
  }

  /** Snapshot a document currently holds. Providers read this, never the network. */
  snapshot(uri: vscode.Uri): DocumentSnapshot | undefined {
    return this.snapshots.get(uri.toString());
  }

  /** Standing query for one document, dropped when the document closes. */
  watch(uri: vscode.Uri): void {
    const key = uri.toString();
    if (this.subscriptions.has(key)) return;
    const unsubscribe = this.client.subscribe<IntelligenceQueryData>(
      key,
      () =>
        this.client.query<IntelligenceQueryData>(
          EDITOR_INTELLIGENCE_QUERY,
          { uri: key },
          (data) => data.fileIntelligence?.generation,
        ),
      (result) => this.deliver(uri, result),
    );
    this.subscriptions.set(key, unsubscribe);
  }

  unwatch(uri: vscode.Uri): void {
    const key = uri.toString();
    this.subscriptions.get(key)?.();
    this.subscriptions.delete(key);
    this.snapshots.delete(key);
    this.diagnostics.delete(uri);
  }

  /** Standing query for readiness, one for the whole window. */
  watchReadiness(): void {
    const unsubscribe = this.client.subscribe<ReadinessQueryData>(
      'theorem:readiness',
      () =>
        this.client.query<ReadinessQueryData>(
          EDITOR_READINESS_QUERY,
          {},
          (data) => data.editorReadiness?.generation,
        ),
      (result) => {
        this.readiness = result.ok ? result.data.editorReadiness : undefined;
        this.renderReadiness(result.ok ? undefined : result.degradation);
      },
    );
    this.disposables.push({ dispose: unsubscribe });
  }

  private deliver(uri: vscode.Uri, result: SubstrateResult<IntelligenceQueryData>): void {
    const key = uri.toString();
    if (!result.ok) {
      // A dead endpoint clears nothing and claims nothing: the last known
      // findings stay put and the degradation says why they may be old.
      this.snapshots.set(key, { ...this.snapshots.get(key), degradation: result.degradation });
      this.onDidChangeEmitter.fire();
      return;
    }

    const intelligence = result.data.fileIntelligence ?? undefined;
    this.snapshots.set(key, { intelligence, degradation: intelligence?.degradation });
    this.diagnostics.set(uri, (intelligence?.diagnostics ?? []).map(toDiagnostic));
    this.onDidChangeEmitter.fire();
  }

  private renderReadiness(degradation?: IntelligenceDegradation): void {
    if (degradation) {
      const text = readableDegradation(degradation);
      this.statusItem.severity = vscode.LanguageStatusSeverity.Warning;
      this.statusItem.text = text;
      this.statusBar.text = '$(circle-slash) Theorem';
      this.statusBar.tooltip = text;
      this.statusBar.show();
      return;
    }

    if (!this.readiness) {
      this.statusItem.severity = vscode.LanguageStatusSeverity.Information;
      this.statusItem.text = 'Theorem: connecting';
      this.statusBar.text = '$(sync) Theorem';
      this.statusBar.show();
      return;
    }

    if (this.readiness.ready) {
      this.statusItem.severity = vscode.LanguageStatusSeverity.Information;
      this.statusItem.text = 'Theorem: ready';
      this.statusBar.text = '$(check) Theorem';
      this.statusBar.tooltip = 'All indexes are ready.';
      this.statusBar.show();
      return;
    }

    const pending = this.readiness.pending.join(', ');
    this.statusItem.severity = vscode.LanguageStatusSeverity.Warning;
    this.statusItem.text = `Theorem: building ${pending}`;
    this.statusBar.text = '$(sync~spin) Theorem';
    this.statusBar.tooltip = `Still building: ${pending}`;
    this.statusBar.show();
  }

  /**
   * Preview a fix, write it through the seam, and leave the buffer alone.
   *
   * Returns the preview that was written so callers can assert
   * preview-equals-applied; the document itself updates when the file change
   * event arrives.
   */
  async applyFix(uri: vscode.Uri, fixId: string): Promise<FixPreview | IntelligenceDegradation> {
    const preview = await this.client.query<ApplyFixData>(
      EDITOR_APPLY_FIX_MUTATION,
      { fixId, uri: uri.toString(), preview: true },
      (data) => data.applyFix?.generation,
    );
    if (!preview.ok) return preview.degradation;
    if (!preview.data.applyFix) {
      return { level: 'unavailable', code: 'editor_fix_unknown', detail: fixId };
    }

    const applied = await this.client.query<ApplyFixData>(
      EDITOR_APPLY_FIX_MUTATION,
      { fixId, uri: uri.toString(), preview: false },
      (data) => data.applyFix?.generation,
    );
    if (!applied.ok) return applied.degradation;
    if (!applied.data.applyFix) {
      return { level: 'unavailable', code: 'editor_fix_unknown', detail: fixId };
    }
    return applied.data.applyFix;
  }

  dispose(): void {
    for (const unsubscribe of this.subscriptions.values()) unsubscribe();
    this.subscriptions.clear();
    this.diagnostics.dispose();
    this.statusItem.dispose();
    this.statusBar.dispose();
    this.onDidChangeEmitter.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }
}

/** Semantic tokens straight off the held snapshot. */
export class TheoremTokenProvider implements vscode.DocumentSemanticTokensProvider {
  constructor(private readonly surface: IntelligenceSurface) {}

  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    return buildTokens(this.surface.snapshot(document.uri)?.intelligence?.tokens ?? []);
  }
}

export class TheoremInlayHintProvider implements vscode.InlayHintsProvider {
  constructor(private readonly surface: IntelligenceSurface) {}

  provideInlayHints(document: vscode.TextDocument, range: vscode.Range): vscode.InlayHint[] {
    const hints = this.surface.snapshot(document.uri)?.intelligence?.inlayHints ?? [];
    return hints
      .filter((hint) => range.contains(toPosition(hint.position)))
      .map((hint) => {
        const inlay = new vscode.InlayHint(toPosition(hint.position), hint.label);
        if (hint.tooltip) inlay.tooltip = hint.tooltip;
        return inlay;
      });
  }
}

/**
 * Intentions at the caret. Quickfixes carry their range and only offer
 * themselves where they apply; the two EDITOR-DX block actions carry no range
 * and are offered wherever there is a selection to send.
 */
export class TheoremCodeActionProvider implements vscode.CodeActionProvider {
  constructor(private readonly surface: IntelligenceSurface) {}

  provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
    const intentions = this.surface.snapshot(document.uri)?.intelligence?.intentions ?? [];
    const actions: vscode.CodeAction[] = [];

    for (const intention of intentions) {
      if (intention.kind === 'block') {
        const action = new vscode.CodeAction(intention.title, vscode.CodeActionKind.Empty);
        action.command = {
          command:
            intention.id === 'int-save-graph'
              ? 'theorem.saveSelectionToGraph'
              : 'theorem.sendSelectionToComposer',
          title: intention.title,
          arguments: [document.uri, range],
        };
        actions.push(action);
        continue;
      }

      if (intention.range && !toRange(intention.range).intersection(range)) continue;
      const action = new vscode.CodeAction(
        intention.title,
        intention.kind === 'refactor'
          ? vscode.CodeActionKind.Refactor
          : vscode.CodeActionKind.QuickFix,
      );
      if (intention.fixId) {
        action.command = {
          command: 'theorem.applyFix',
          title: intention.title,
          arguments: [document.uri, intention.fixId],
        };
      }
      actions.push(action);
    }

    return actions;
  }
}
