/**
 * Pure logic for the Work Surface's doc/code stages (WS5) and their
 * collab-item minting (WS6).
 *
 * Kept dependency-free so it is trivially unit-testable without a DOM:
 * the CodeMirror + Yjs wiring in WorkTextEditor.tsx consumes these
 * helpers but does none of the branching itself.
 */

export type WorkTextStageKind = 'doc' | 'code';

/** Languages the code stage's picker offers. Doc stage is always markdown. */
export type LanguageId = 'markdown' | 'javascript' | 'typescript' | 'python' | 'json' | 'plaintext';

export const CODE_LANGUAGES: readonly LanguageId[] = [
  'javascript',
  'typescript',
  'python',
  'json',
  'plaintext',
];

export const LANGUAGE_LABELS: Record<LanguageId, string> = {
  markdown: 'Markdown',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  json: 'JSON',
  plaintext: 'Plain text',
};

/** Default language for a freshly opened stage. Doc is fixed; code defaults to JS. */
export function defaultLanguageForStage(kind: WorkTextStageKind): LanguageId {
  return kind === 'doc' ? 'markdown' : 'javascript';
}

/** Whether the language picker should be shown (doc stage's language is not user-selectable). */
export function isLanguageSelectable(kind: WorkTextStageKind): boolean {
  return kind === 'code';
}

/**
 * WS6: the collab-token route (api/commonplace/collab-token/route.ts) only
 * ever mints a token for a documentName starting with "commonplace-page:",
 * and only after verifying the backing Item's kind === 'doc' over GraphQL.
 * That gate is intentionally not loosened, so every work-surface stage that
 * wants real Hocuspocus collab -- doc AND code alike -- must present its
 * document under this exact contentType. This is the "Use AS IS, zero
 * server changes" reuse the doc stage already had; WS6 extends it to code
 * by minting a real Item (see mintTitleForStage) rather than inventing a
 * parallel collab channel.
 */
export const COMMONPLACE_PAGE_CONTENT_TYPE = 'commonplace-page';

/** Default title for a freshly minted backing Item, before the user renames it. */
export function mintTitleForStage(kind: WorkTextStageKind): string {
  return kind === 'doc' ? 'Untitled document' : 'Untitled file';
}

/**
 * Local-only document id used only while a backing Item is being minted, or
 * after minting failed outright (no reachable CommonPlace API). Distinct per
 * kind so a failed doc-stage mint and a failed code-stage mint never share
 * local IndexedDB storage. This is never presented as a real page: if collab
 * is enabled the token route will 404 on it (no such Item) and the editor
 * falls back to the same honest "Local only" status as any other kind !==
 * 'doc' rejection -- no special-casing needed in the collab hook.
 */
export function scratchDocumentId(kind: WorkTextStageKind): string {
  return kind === 'doc' ? 'work-surface-scratch-doc' : 'work-surface-scratch-code';
}

export interface CollabStatusDisplay {
  label: string;
  tone: 'idle' | 'progress' | 'ok' | 'warn';
}

/**
 * Maps useCommonplaceCollabYjs's collabStatus (+ localSynced) to a short,
 * honest status-pill label. Never claims sync that hasn't happened.
 */
export function collabStatusDisplay(
  collabStatus: string,
  localSynced: boolean,
): CollabStatusDisplay {
  switch (collabStatus) {
    case 'disabled':
      return { label: localSynced ? 'Saved locally' : 'Loading…', tone: localSynced ? 'idle' : 'progress' };
    case 'token-loading':
    case 'connecting':
      return { label: 'Connecting…', tone: 'progress' };
    case 'authenticated':
    case 'connected':
      return { label: 'Synced', tone: 'ok' };
    case 'disconnected':
      return { label: 'Offline (saved locally)', tone: 'warn' };
    case 'auth-failed':
      return { label: 'Local only', tone: 'warn' };
    default:
      return { label: 'Local only', tone: 'warn' };
  }
}
