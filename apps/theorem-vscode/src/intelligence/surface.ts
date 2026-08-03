// SOURCING: vscode extension API (diagnostics, semantic tokens, inlay hints,
// code actions, language status). No third-party library sits between the pack
// and the API; the contract types come from @commonplace/block-view-contracts.
/**
 * V2. Intelligence providers.
 *
 * Detector findings become a DiagnosticCollection, captured spans become
 * semantic tokens, hints become inlay hints, intentions become code actions at
 * the caret, and readiness becomes a language status item plus a status bar
 * chip. Everything reads one standing query per open document through the V1
 * client, so a background store mutation repaints the editor with no
 * interaction.
 *
 * Four rules are enforced here rather than documented:
 *
 * - Named choice 9, fix application stays watch-confirmed. `applyFix` previews
 *   through `previewFix`, applies through `applyFix`, and then *stops*. The
 *   buffer changes when the file change event arrives. Nothing optimistically
 *   edits the document, so a write the seam refused can never leave a lying
 *   buffer behind.
 * - Named choice 6, the typing-latency law is inherited. Every provider here
 *   answers from the last delivered snapshot, held in memory. No provider awaits
 *   the network inside a `provideX` call, so a slow substrate cannot make the
 *   editor's own render path wait on it.
 * - **Conversion happens once, at delivery.** The surface speaks UTF-8 byte
 *   offsets; VS Code speaks UTF-16. Converting per provider call would repeat
 *   the work on every repaint and, worse, would convert against whatever the
 *   buffer happens to hold at that moment. Ranges are resolved when the answer
 *   lands, against the bytes the server says it indexed, and dropped when those
 *   two disagree.
 * - **Reduced is quiet.** `degraded: true` with a named missing index is the
 *   steady state, not an alarm; see `../degradation.ts`.
 */

import * as vscode from 'vscode';
import type {
  ApplyFixResult,
  AppliedFix,
  DiagnosticsPayload,
  EditorDiagnostic,
  EditorIntention,
  EditorSeverity,
  InlayHint,
  InlayHintsPayload,
  IntentionsPayload,
  ReadinessPayload,
  SemanticToken,
  SemanticTokensPayload,
  UnavailableSurface,
} from '@commonplace/block-view-contracts/editor-intelligence';
import {
  APPLY_FIX_MUTATION,
  FILE_INTELLIGENCE_QUERY,
  INTENTIONS_QUERY,
  PREVIEW_FIX_QUERY,
  READINESS_QUERY,
  SAVE_SELECTION_TO_GRAPH,
  SEND_SELECTION_TO_COMPOSER,
  isConcurrencyRefusal,
} from '@commonplace/block-view-contracts/editor-intelligence';
import type { ContentDrift, OffsetTable } from '@commonplace/block-view-contracts/editor-offsets';
import { resolveOffsets, toUtf16Span, utf16ToByte } from '@commonplace/block-view-contracts/editor-offsets';
import type { SubstrateClient, SubstrateResult } from '../substrate/client';

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

/** One wire span, converted into the editor's own coordinates. */
export function toRange(table: OffsetTable, startByte: number, endByte: number): vscode.Range {
  const { start, end } = toUtf16Span(table, startByte, endByte);
  return new vscode.Range(
    positionAt(table.content, start),
    positionAt(table.content, end),
  );
}

/**
 * UTF-16 index to line/character.
 *
 * `TextDocument.positionAt` would do this, but the conversion has to run
 * against the *indexed* text — the bytes the server measured — and that text is
 * not always what the open document holds. Doing it here keeps the two from
 * being silently mixed.
 */
export function positionAt(content: string, index: number): vscode.Position {
  const clamped = Math.max(0, Math.min(index, content.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < clamped; i += 1) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return new vscode.Position(line, clamped - lineStart);
}

const SEVERITY: Record<EditorSeverity, vscode.DiagnosticSeverity> = {
  info: vscode.DiagnosticSeverity.Information,
  warning: vscode.DiagnosticSeverity.Warning,
  error: vscode.DiagnosticSeverity.Error,
  // The surface distinguishes fatal from error; VS Code does not. Collapsing
  // upward keeps a fatal finding at least as loud as an error.
  fatal: vscode.DiagnosticSeverity.Error,
};

export function toDiagnostic(table: OffsetTable, finding: EditorDiagnostic): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    toRange(table, finding.startByte, finding.endByte),
    finding.message,
    SEVERITY[finding.severity] ?? vscode.DiagnosticSeverity.Information,
  );
  diagnostic.source = 'theorem';
  diagnostic.code = finding.detector;
  return diagnostic;
}

const HINT_KINDS: Record<InlayHint['kind'], vscode.InlayHintKind | undefined> = {
  type: vscode.InlayHintKind.Type,
  parameter: vscode.InlayHintKind.Parameter,
  other: undefined,
};

export function toInlayHint(table: OffsetTable, hint: InlayHint): vscode.InlayHint {
  const { start } = toUtf16Span(table, hint.positionByte, hint.positionByte);
  const inlay = new vscode.InlayHint(positionAt(table.content, start), hint.label);
  const kind = HINT_KINDS[hint.kind];
  if (kind !== undefined) inlay.kind = kind;
  return inlay;
}

/**
 * Encode spans into VS Code's delta-packed token format.
 *
 * The builder wants tokens in document order; the store is free to answer in
 * any order, so sort before building rather than trusting the wire.
 */
export function buildTokens(
  table: OffsetTable,
  spans: readonly SemanticToken[],
): vscode.SemanticTokens {
  const builder = new vscode.SemanticTokensBuilder(SEMANTIC_LEGEND);
  const ordered = [...spans].sort((a, b) => a.startByte - b.startByte || a.endByte - b.endByte);
  for (const span of ordered) {
    if (!(TOKEN_TYPES as readonly string[]).includes(span.tokenType)) continue;
    builder.push(
      toRange(table, span.startByte, span.endByte),
      span.tokenType,
      span.modifiers.filter((modifier) => (TOKEN_MODIFIERS as readonly string[]).includes(modifier)),
    );
  }
  return builder.build();
}

/** An intention with its range already in editor coordinates. */
export interface ResolvedIntention {
  readonly intention: EditorIntention;
  readonly range: vscode.Range;
}

/** What the providers render for one document, plus why it may be partial. */
export interface DocumentSnapshot {
  readonly generation: number;
  readonly contentHash: string;
  readonly tokens: vscode.SemanticTokens;
  readonly hints: readonly vscode.InlayHint[];
  readonly intentions: readonly ResolvedIntention[];
  /**
   * The index built from the bytes this snapshot describes. Held so the caret
   * can be converted into a byte offset against the *indexed* text rather than
   * whatever the buffer holds when the cursor moves. Absent while drifted.
   */
  readonly table?: OffsetTable;
  /** Named indexes the surface answered without. Empty means whole. */
  readonly missingIndexes: readonly string[];
  /** Set when nothing answered. The loud state. */
  readonly unavailable?: UnavailableSurface;
  /** Set when the buffer moved past the bytes the answer describes. */
  readonly drift?: ContentDrift;
}

interface FileQueryData {
  readonly semanticTokens: SemanticTokensPayload;
  readonly diagnostics: DiagnosticsPayload;
  readonly inlayHints: InlayHintsPayload;
}

interface IntentionsQueryData {
  readonly intentions: IntentionsPayload;
}

interface ReadinessQueryData {
  readonly readiness: ReadinessPayload;
}

interface PreviewFixData {
  readonly previewFix: AppliedFix | null;
}

interface ApplyFixData {
  readonly applyFix: ApplyFixResult | null;
}

const EMPTY_TOKENS = new vscode.SemanticTokensBuilder(SEMANTIC_LEGEND).build();

export class IntelligenceSurface implements vscode.Disposable {
  private readonly diagnostics = vscode.languages.createDiagnosticCollection('theorem');
  private readonly snapshots = new Map<string, DocumentSnapshot>();
  private readonly subscriptions = new Map<string, () => void>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  private readonly statusItem: vscode.LanguageStatusItem;
  private readonly statusBar: vscode.StatusBarItem;
  private readiness: ReadinessPayload | undefined;
  private readinessUnavailable: UnavailableSurface | undefined;

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

  /**
   * Standing query for one document, dropped when the document closes.
   *
   * The surface addresses files by absolute path under a mounted content root,
   * so the subscription is bound to `fsPath` and the invalidation door can
   * refresh this file alone.
   */
  watch(uri: vscode.Uri): void {
    const key = uri.toString();
    if (this.subscriptions.has(key)) return;
    const file = uri.fsPath;
    const unsubscribe = this.client.subscribe<FileQueryData>(
      key,
      () =>
        this.client.query<FileQueryData>(
          FILE_INTELLIGENCE_QUERY,
          { file, includeContent: true },
          (data) => data.semanticTokens?.generation,
        ),
      (result) => this.deliver(uri, result),
      { path: file },
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
          READINESS_QUERY,
          {},
          (data) => data.readiness?.generation,
        ),
      (result) => {
        this.readiness = result.ok ? result.data.readiness : undefined;
        this.readinessUnavailable = result.ok ? undefined : result.degradation;
        this.renderReadiness();
      },
    );
    this.disposables.push({ dispose: unsubscribe });
  }

  /**
   * Refresh the caret-local intentions for one document.
   *
   * Intentions are the one surface that takes a position, so they cannot ride
   * the standing query without re-querying on every cursor move. They refresh
   * on selection change instead, and land in the same snapshot the code action
   * provider reads.
   */
  async refreshIntentions(document: vscode.TextDocument, position: vscode.Position): Promise<void> {
    const key = document.uri.toString();
    const held = this.snapshots.get(key);
    // No held table means the last answer was about bytes this buffer no longer
    // holds. Asking for intentions at a byte offset derived from either text
    // would be asking about a position that exists in neither.
    if (!held?.table) return;
    if (held.table.content !== document.getText()) return;

    const result = await this.client.query<IntentionsQueryData>(
      INTENTIONS_QUERY,
      {
        file: document.uri.fsPath,
        position: utf16ToByte(held.table, document.offsetAt(position)),
        includeContent: true,
      },
      (data) => data.intentions?.generation,
    );
    if (!result.ok) return;

    const payload = result.data.intentions;
    const converted = resolveOffsets(payload, document.getText());
    const table = converted.table;
    if (!table) return;

    const current = this.snapshots.get(key);
    if (!current || current.contentHash !== payload.contentHash) return;
    this.snapshots.set(key, {
      ...current,
      intentions: payload.intentions.map((intention) => ({
        intention,
        range: toRange(table, intention.startByte, intention.endByte),
      })),
    });
    this.onDidChangeEmitter.fire();
  }

  private deliver(uri: vscode.Uri, result: SubstrateResult<FileQueryData>): void {
    const key = uri.toString();
    const held = this.snapshots.get(key);

    if (!result.ok) {
      // A dead endpoint clears nothing and claims nothing: the last known
      // findings stay put and the degradation says why they may be old.
      this.snapshots.set(key, {
        ...(held ?? blankSnapshot()),
        unavailable: result.degradation,
      });
      this.onDidChangeEmitter.fire();
      return;
    }

    const { semanticTokens, diagnostics, inlayHints } = result.data;
    const document = vscode.workspace.textDocuments.find(
      (candidate) => candidate.uri.toString() === key,
    );
    const bufferText = document?.getText() ?? semanticTokens.content ?? '';
    const resolved = resolveOffsets(semanticTokens, bufferText);

    if (!resolved.table) {
      // The answer is about bytes the reader has moved past. Holding the old
      // findings and naming the drift beats drawing spans at the wrong offsets,
      // which is the failure this whole conversion path exists to prevent.
      this.snapshots.set(key, {
        ...(held ?? blankSnapshot()),
        generation: semanticTokens.generation,
        contentHash: semanticTokens.contentHash,
        missingIndexes: semanticTokens.missingIndexes,
        // The held table described bytes that are now provably not the buffer's.
        // Keeping it would let the caret path convert against stale text.
        table: undefined,
        drift: resolved.drift,
      });
      this.onDidChangeEmitter.fire();
      return;
    }

    const table = resolved.table;
    // The three payloads must describe the same bytes. When they do not, one of
    // them raced an edit; the mismatched surface is skipped rather than mixed.
    const sameBytes = (hash: string) => hash === semanticTokens.contentHash;

    this.snapshots.set(key, {
      generation: semanticTokens.generation,
      contentHash: semanticTokens.contentHash,
      tokens: buildTokens(table, semanticTokens.tokens),
      hints: sameBytes(inlayHints.contentHash)
        ? inlayHints.hints.map((hint) => toInlayHint(table, hint))
        : [],
      // Intentions are caret-local and arrive on their own schedule; a fresh
      // file answer keeps the ones already resolved against the same bytes.
      intentions: held?.contentHash === semanticTokens.contentHash ? held.intentions : [],
      table,
      missingIndexes: dedupe([
        ...semanticTokens.missingIndexes,
        ...diagnostics.missingIndexes,
        ...inlayHints.missingIndexes,
      ]),
    });

    this.diagnostics.set(
      uri,
      sameBytes(diagnostics.contentHash)
        ? diagnostics.diagnostics.map((finding) => toDiagnostic(table, finding))
        : [],
    );
    this.onDidChangeEmitter.fire();
  }

  private renderReadiness(): void {
    if (this.readinessUnavailable) {
      // Loud: nothing answered.
      const text = 'Theorem: unreachable';
      this.statusItem.severity = vscode.LanguageStatusSeverity.Error;
      this.statusItem.text = text;
      this.statusBar.text = '$(circle-slash) Theorem';
      this.statusBar.tooltip = this.readinessUnavailable.detail ?? text;
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

    const building = this.readiness.capabilities.filter(
      (capability) => capability.state === 'building',
    );

    if (building.length === 0) {
      this.statusItem.severity = vscode.LanguageStatusSeverity.Information;
      this.statusItem.text = 'Theorem: ready';
      this.statusBar.text = '$(check) Theorem';
      this.statusBar.tooltip = 'All indexes are ready.';
      this.statusBar.show();
      return;
    }

    // Quiet: the surface is answering while an index warms. Information, not
    // Warning, and a spinner rather than a slashed circle.
    const names = building.map((capability) => capability.capability).join(', ');
    this.statusItem.severity = vscode.LanguageStatusSeverity.Information;
    this.statusItem.text = `Theorem: building ${names}`;
    this.statusBar.text = '$(sync~spin) Theorem';
    this.statusBar.tooltip = `Answering now; still building: ${names}`;
    this.statusBar.show();
  }

  /**
   * Preview a fix, apply it, and leave the buffer alone.
   *
   * Returns the applied result so callers can assert preview-equals-applied;
   * the document itself updates when the file change event arrives. A refusal
   * comes back as a value, because the caller's correct response to one is
   * specific: re-read and re-offer, not fail.
   */
  async applyFix(fixId: string): Promise<AppliedFix | ApplyFixResult | UnavailableSurface> {
    const preview = await this.client.query<PreviewFixData>(
      PREVIEW_FIX_QUERY,
      { fixId },
      (data) => data.previewFix?.appliedGeneration,
    );
    if (!preview.ok) return preview.degradation;
    if (!preview.data.previewFix) {
      return { level: 'unavailable', code: 'editor_fix_unknown', detail: fixId };
    }

    const applied = await this.client.query<ApplyFixData>(APPLY_FIX_MUTATION, { fixId });
    if (!applied.ok) return applied.degradation;
    const result = applied.data.applyFix;
    if (!result) {
      return { level: 'unavailable', code: 'editor_fix_unknown', detail: fixId };
    }
    return result;
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

function blankSnapshot(): DocumentSnapshot {
  return {
    generation: -1,
    contentHash: '',
    tokens: EMPTY_TOKENS,
    hints: [],
    intentions: [],
    missingIndexes: [],
  };
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

/** Semantic tokens straight off the held snapshot. */
export class TheoremTokenProvider implements vscode.DocumentSemanticTokensProvider {
  constructor(private readonly surface: IntelligenceSurface) {}

  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    return this.surface.snapshot(document.uri)?.tokens ?? EMPTY_TOKENS;
  }
}

export class TheoremInlayHintProvider implements vscode.InlayHintsProvider {
  constructor(private readonly surface: IntelligenceSurface) {}

  provideInlayHints(document: vscode.TextDocument, range: vscode.Range): vscode.InlayHint[] {
    const hints = this.surface.snapshot(document.uri)?.hints ?? [];
    return hints.filter((hint) => range.contains(hint.position));
  }
}

/**
 * Intentions at the caret.
 *
 * Inspection fixes carry their range and only offer themselves where they
 * apply. The two block actions are recognised by their published ids rather
 * than by title or by a guessed prefix, so a change of wording upstream cannot
 * silently reroute them.
 */
export class TheoremCodeActionProvider implements vscode.CodeActionProvider {
  constructor(private readonly surface: IntelligenceSurface) {}

  provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
    const resolved = this.surface.snapshot(document.uri)?.intentions ?? [];
    const actions: vscode.CodeAction[] = [];

    for (const { intention, range: intentionRange } of resolved) {
      if (intention.kind === 'block_action') {
        const command = BLOCK_ACTION_COMMANDS[intention.id];
        if (!command) continue;
        const action = new vscode.CodeAction(intention.title, vscode.CodeActionKind.Empty);
        action.command = { command, title: intention.title, arguments: [document.uri, range] };
        actions.push(action);
        continue;
      }

      if (!intentionRange.intersection(range)) continue;
      const action = new vscode.CodeAction(intention.title, vscode.CodeActionKind.QuickFix);
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

const BLOCK_ACTION_COMMANDS: Record<string, string> = {
  [SEND_SELECTION_TO_COMPOSER]: 'theorem.sendSelectionToComposer',
  [SAVE_SELECTION_TO_GRAPH]: 'theorem.saveSelectionToGraph',
};

export { isConcurrencyRefusal };
