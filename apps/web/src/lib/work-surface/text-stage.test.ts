import { describe, expect, it } from 'vitest';
import {
  CODE_LANGUAGES,
  COMMONPLACE_PAGE_CONTENT_TYPE,
  LANGUAGE_LABELS,
  collabStatusDisplay,
  defaultLanguageForStage,
  isLanguageSelectable,
  mintTitleForStage,
  scratchDocumentId,
} from './text-stage';

describe('defaultLanguageForStage', () => {
  it('defaults doc stage to markdown', () => {
    expect(defaultLanguageForStage('doc')).toBe('markdown');
  });

  it('defaults code stage to javascript', () => {
    expect(defaultLanguageForStage('code')).toBe('javascript');
  });
});

describe('isLanguageSelectable', () => {
  it('is false for doc (markdown is fixed)', () => {
    expect(isLanguageSelectable('doc')).toBe(false);
  });

  it('is true for code', () => {
    expect(isLanguageSelectable('code')).toBe(true);
  });
});

describe('CODE_LANGUAGES / LANGUAGE_LABELS', () => {
  it('has a label for every code language plus markdown', () => {
    for (const lang of CODE_LANGUAGES) {
      expect(LANGUAGE_LABELS[lang]).toBeTruthy();
    }
    expect(LANGUAGE_LABELS.markdown).toBe('Markdown');
  });

  it('does not include markdown among the user-selectable code languages', () => {
    expect(CODE_LANGUAGES).not.toContain('markdown');
  });
});

describe('COMMONPLACE_PAGE_CONTENT_TYPE', () => {
  it('is the exact literal the collab-token route gates on', () => {
    // api/commonplace/collab-token/route.ts only mints a token for
    // documentName.startsWith('commonplace-page:'); every stage that wants
    // real Hocuspocus collab must reuse this literal, not a work-surface-*
    // namespace of its own.
    expect(COMMONPLACE_PAGE_CONTENT_TYPE).toBe('commonplace-page');
  });
});

describe('mintTitleForStage', () => {
  it('gives a doc stage an "Untitled document" title', () => {
    expect(mintTitleForStage('doc')).toBe('Untitled document');
  });

  it('gives a code stage an "Untitled file" title', () => {
    expect(mintTitleForStage('code')).toBe('Untitled file');
  });
});

describe('scratchDocumentId', () => {
  it('gives doc and code distinct, stable local-only fallback ids', () => {
    expect(scratchDocumentId('doc')).toBe('work-surface-scratch-doc');
    expect(scratchDocumentId('code')).toBe('work-surface-scratch-code');
    expect(scratchDocumentId('doc')).not.toBe(scratchDocumentId('code'));
  });
});

describe('collabStatusDisplay', () => {
  it('shows Loading while local persistence has not synced and collab is disabled', () => {
    expect(collabStatusDisplay('disabled', false)).toEqual({ label: 'Loading…', tone: 'progress' });
  });

  it('shows Saved locally once local persistence has synced and collab is disabled', () => {
    expect(collabStatusDisplay('disabled', true)).toEqual({ label: 'Saved locally', tone: 'idle' });
  });

  it('shows Connecting during token-loading/connecting', () => {
    expect(collabStatusDisplay('token-loading', false).label).toBe('Connecting…');
    expect(collabStatusDisplay('connecting', false).label).toBe('Connecting…');
  });

  it('shows Synced once authenticated/connected', () => {
    expect(collabStatusDisplay('authenticated', true)).toEqual({ label: 'Synced', tone: 'ok' });
    expect(collabStatusDisplay('connected', true)).toEqual({ label: 'Synced', tone: 'ok' });
  });

  it('shows an honest offline label on disconnect, never claiming sync', () => {
    expect(collabStatusDisplay('disconnected', true)).toEqual({
      label: 'Offline (saved locally)',
      tone: 'warn',
    });
  });

  it('shows Local only when the collab token/auth failed', () => {
    expect(collabStatusDisplay('auth-failed', true)).toEqual({ label: 'Local only', tone: 'warn' });
  });

  it('falls back to Local only for any unrecognized status', () => {
    expect(collabStatusDisplay('some-future-status', true).label).toBe('Local only');
  });
});
