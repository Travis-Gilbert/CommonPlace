// SOURCING: hand-written stand-in for the `vscode` module, which is only
// injectable at runtime by the extension host and has no published test double.
// @vscode/test-electron exists but boots a real Electron VS Code, which is the
// wrong oracle for pure provider logic and cannot run in this repo's CI lane.
/**
 * Enough of the `vscode` namespace for the pack's providers to run headlessly.
 *
 * Shapes match the real API where behavior is asserted (delta-encoded semantic
 * tokens, Range.intersection, Range.contains) and are inert where it is not.
 * Anything the pack starts using must be added here, which is the point: a stub
 * that silently answers undefined would let a provider "pass" against an API it
 * never actually called.
 */

export class Position {
  constructor(
    readonly line: number,
    readonly character: number,
  ) {}

  isBeforeOrEqual(other: Position): boolean {
    return this.line < other.line || (this.line === other.line && this.character <= other.character);
  }
}

export class Range {
  readonly start: Position;
  readonly end: Position;

  constructor(
    startLine: number | Position,
    startCharacter: number | Position,
    endLine?: number,
    endCharacter?: number,
  ) {
    if (startLine instanceof Position && startCharacter instanceof Position) {
      this.start = startLine;
      this.end = startCharacter;
    } else {
      this.start = new Position(startLine as number, startCharacter as number);
      this.end = new Position(endLine as number, endCharacter as number);
    }
  }

  contains(position: Position): boolean {
    return this.start.isBeforeOrEqual(position) && position.isBeforeOrEqual(this.end);
  }

  /** Real API returns undefined when the ranges do not overlap. */
  intersection(other: Range): Range | undefined {
    const start = this.start.isBeforeOrEqual(other.start) ? other.start : this.start;
    const end = this.end.isBeforeOrEqual(other.end) ? this.end : other.end;
    return start.isBeforeOrEqual(end) ? new Range(start, end) : undefined;
  }
}

export class Uri {
  private constructor(
    readonly scheme: string,
    readonly authority: string,
    readonly path: string,
    readonly query: string,
    readonly fsPath: string,
  ) {}

  static parse(value: string): Uri {
    const url = new URL(value);
    return new Uri(
      url.protocol.replace(/:$/, ''),
      url.host,
      decodeURIComponent(url.pathname),
      url.search.replace(/^\?/, ''),
      decodeURIComponent(url.pathname),
    );
  }

  static file(path: string): Uri {
    return new Uri('file', '', path, '', path);
  }

  with(change: { scheme?: string; query?: string }): Uri {
    return new Uri(
      change.scheme ?? this.scheme,
      this.authority,
      this.path,
      change.query ?? this.query,
      this.fsPath,
    );
  }

  toString(): string {
    const query = this.query ? `?${this.query}` : '';
    return `${this.scheme}://${this.authority}${this.path}${query}`;
  }
}

export class Disposable {
  constructor(private readonly callback: () => void) {}
  dispose(): void {
    this.callback();
  }
}

export class EventEmitter<T> {
  private readonly listeners: ((value: T) => void)[] = [];

  readonly event = (listener: (value: T) => void): Disposable => {
    this.listeners.push(listener);
    return new Disposable(() => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    });
  };

  fire(value: T): void {
    for (const listener of [...this.listeners]) listener(value);
  }

  dispose(): void {
    this.listeners.length = 0;
  }
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Diagnostic {
  source?: string;
  code?: string;
  constructor(
    readonly range: Range,
    readonly message: string,
    readonly severity: DiagnosticSeverity,
  ) {}
}

export class SemanticTokensLegend {
  constructor(
    readonly tokenTypes: string[],
    readonly tokenModifiers: string[],
  ) {}
}

export interface SemanticTokens {
  readonly data: Uint32Array;
}

/** Delta-encodes exactly as the real builder does, so ordering bugs surface. */
export class SemanticTokensBuilder {
  private readonly data: number[] = [];
  private lastLine = 0;
  private lastCharacter = 0;

  constructor(private readonly legend: SemanticTokensLegend) {}

  push(range: Range, type: string, modifiers: string[] = []): void {
    const typeIndex = this.legend.tokenTypes.indexOf(type);
    if (typeIndex < 0) return;
    let modifierBits = 0;
    for (const modifier of modifiers) {
      const index = this.legend.tokenModifiers.indexOf(modifier);
      if (index >= 0) modifierBits |= 1 << index;
    }

    const deltaLine = range.start.line - this.lastLine;
    const deltaStart =
      deltaLine === 0 ? range.start.character - this.lastCharacter : range.start.character;
    this.data.push(
      deltaLine,
      deltaStart,
      range.end.character - range.start.character,
      typeIndex,
      modifierBits,
    );
    this.lastLine = range.start.line;
    this.lastCharacter = range.start.character;
  }

  build(): SemanticTokens {
    return { data: Uint32Array.from(this.data) };
  }
}

export class InlayHint {
  tooltip?: string;
  constructor(
    readonly position: Position,
    readonly label: string,
  ) {}
}

export class CodeActionKind {
  private constructor(readonly value: string) {}
  static readonly Empty = new CodeActionKind('');
  static readonly QuickFix = new CodeActionKind('quickfix');
  static readonly Refactor = new CodeActionKind('refactor');
}

export class CodeAction {
  command?: { command: string; title: string; arguments?: unknown[] };
  constructor(
    readonly title: string,
    readonly kind: CodeActionKind,
  ) {}
}

export class TimelineItem {
  id?: string;
  detail?: string;
  contextValue?: string;
  command?: { command: string; title: string; arguments?: unknown[] };
  constructor(
    readonly label: string,
    readonly timestamp: number,
  ) {}
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
}

export enum FileChangeType {
  Changed = 1,
  Created = 2,
  Deleted = 3,
}

export class FileSystemError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
  static FileNotFound(uri?: unknown): FileSystemError {
    return new FileSystemError(String(uri), 'FileNotFound');
  }
  static NoPermissions(message?: string): FileSystemError {
    return new FileSystemError(message ?? '', 'NoPermissions');
  }
  static Unavailable(message?: string): FileSystemError {
    return new FileSystemError(message ?? '', 'Unavailable');
  }
}

export enum LanguageStatusSeverity {
  Information = 0,
  Warning = 1,
  Error = 2,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

interface StubStatusItem {
  name?: string;
  text: string;
  tooltip?: string;
  severity?: LanguageStatusSeverity;
  show?(): void;
  hide?(): void;
  dispose(): void;
}

function statusItem(): StubStatusItem {
  return { text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined };
}

/** Diagnostics actually recorded, so tests can read what the surface set. */
export const recordedDiagnostics = new Map<string, Diagnostic[]>();

export const languages = {
  createDiagnosticCollection: () => ({
    set: (uri: Uri, diagnostics: Diagnostic[]) =>
      recordedDiagnostics.set(uri.toString(), diagnostics),
    delete: (uri: Uri) => recordedDiagnostics.delete(uri.toString()),
    dispose: () => recordedDiagnostics.clear(),
  }),
  createLanguageStatusItem: () => statusItem(),
  registerDocumentSemanticTokensProvider: () => new Disposable(() => undefined),
  registerInlayHintsProvider: () => new Disposable(() => undefined),
  registerCodeActionsProvider: () => new Disposable(() => undefined),
};

/** Messages shown, so the permission round-trip is assertable. */
export const shownMessages: { message: string; options: string[] }[] = [];
export let messageAnswer: string | undefined;
export function setMessageAnswer(answer: string | undefined): void {
  messageAnswer = answer;
}

/** Quick pick answer and the items it was offered, for the V3 fallback test. */
export let quickPickAnswer: unknown;
export const quickPickItems: unknown[][] = [];
export function setQuickPickAnswer(answer: unknown): void {
  quickPickAnswer = answer;
}

export const window = {
  activeTextEditor: undefined as { document: { uri: Uri } } | undefined,
  showQuickPick: async (items: unknown[]) => {
    quickPickItems.push(items);
    return quickPickAnswer;
  },
  createStatusBarItem: () => statusItem(),
  createOutputChannel: () => ({ appendLine: () => undefined, dispose: () => undefined }),
  showInformationMessage: async (message: string, _options: unknown, ...items: string[]) => {
    shownMessages.push({ message, options: items });
    return messageAnswer;
  },
  showWarningMessage: async (message: string) => {
    shownMessages.push({ message, options: [] });
    return undefined;
  },
  showTextDocument: async () => undefined,
};

export const workspace = {
  workspaceFolders: undefined as { uri: Uri }[] | undefined,
  getConfiguration: () => ({ get: (_key: string, fallback?: unknown) => fallback }),
  openTextDocument: async () => ({ getText: () => '' }),
  registerFileSystemProvider: () => new Disposable(() => undefined),
  registerTextDocumentContentProvider: () => new Disposable(() => undefined),
  onDidOpenTextDocument: () => new Disposable(() => undefined),
  onDidCloseTextDocument: () => new Disposable(() => undefined),
  textDocuments: [] as unknown[],
};

/** Commands executed, so the quick pick's hand-off is assertable. */
export const executedCommands: { command: string; args: unknown[] }[] = [];

export const commands = {
  registerCommand: () => new Disposable(() => undefined),
  executeCommand: async (command: string, ...args: unknown[]) => {
    executedCommands.push({ command, args });
    return undefined;
  },
};

export const env = {
  openExternal: async () => true,
};
