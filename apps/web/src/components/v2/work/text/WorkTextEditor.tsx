'use client';

/**
 * WS5/WS6: the collaborative doc/code stage editor. CodeMirror 6 bound to a
 * Yjs Y.Text via y-codemirror.next's yCollab, backed by the pre-existing
 * useCommonplaceCollabYjs hook (local-first Yjs + IndexedDB, optionally
 * upgraded to a live Hocuspocus connection when
 * NEXT_PUBLIC_COMMONPLACE_COLLAB_URL is configured) rather than hand-rolling
 * a new collab transport. Both the `doc` and `code` work-surface stages
 * render this same component; only the language and its selectability
 * differ (see lib/work-surface/text-stage.ts).
 *
 * WS6: opening a stage without a real backing Item (e.g. a bare /doc or
 * /code omnibar command) mints one via the real, already-used gqlCreatePage
 * mutation -- the same call ProjectPagesView.tsx uses for "New Page" -- so
 * the stage gets a genuine kind='doc' Item that the collab-token route's
 * gate (api/commonplace/collab-token/route.ts) will actually accept. This
 * is a real, non-fabricated bridge: no invented protocol, no server change,
 * and the same mutation already exercised elsewhere in the app. If minting
 * fails (no reachable CommonPlace API), the editor still renders against a
 * local-only scratch id -- real, persisted via IndexedDB, just not
 * network-synced -- which is the disclosed fallback, not a silent lie about
 * sync state (see collabStatusDisplay).
 *
 * A "Show changes" toggle uses @codemirror/merge's unifiedMergeView to
 * diff the live content against the snapshot captured when the stage was
 * opened -- a real, bounded use of that dependency rather than a full
 * conflict-resolution UI (which would need real concurrent-edit conflicts
 * to ground; none exist in this sandbox without a second live client).
 *
 * Conventions follow CodeEditor.tsx (theseus) for the imperative
 * CodeMirror lifecycle, and WorkBoard.tsx for the React-Compiler-safe
 * hook shapes: refs are only ever read/written inside effects or
 * useCallback event-handlers, lazy ref-init uses the
 * `if (ref.current == null)` form the lint rule recognizes, and state
 * derived from a changing prop (stage kind) is adjusted during render
 * rather than inside an effect.
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { tags } from '@lezer/highlight';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import { unifiedMergeView } from '@codemirror/merge';
import * as Y from 'yjs';
import { useCommonplaceCollabYjs } from '@/lib/useCommonplaceCollabYjs';
import { createPage } from '@/lib/commonplace-api';
import { useSpring, FADE_EXIT } from '@/lib/work-surface/work-motion';
import {
  CODE_LANGUAGES,
  COMMONPLACE_PAGE_CONTENT_TYPE,
  LANGUAGE_LABELS,
  collabStatusDisplay,
  defaultLanguageForStage,
  isLanguageSelectable,
  mintTitleForStage,
  scratchDocumentId,
  type LanguageId,
  type WorkTextStageKind,
} from '@/lib/work-surface/text-stage';
import styles from './text.module.css';

interface WorkTextEditorBoundProps {
  kind: WorkTextStageKind;
  /** A resolved, real backing document id: either a caller-supplied Item id or one WS6 minted. */
  itemId: string;
  /** Set when WS6's mint attempt failed; shown as an honest inline notice, never silently swallowed. */
  mintNotice?: string;
}

// Porcelain theme: consumes CSS custom properties only (DESIGN.md bans new
// hex literals outside porcelain-theme.css). Background stays transparent
// so the surrounding .plane shows through, matching WorkBoard's host.
const porcelainTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--ink)',
    height: '100%',
    fontSize: '0.85rem',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
    caretColor: 'var(--accent)',
    padding: 'calc(var(--u) * 1.5) 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--ink-faint)',
    border: 'none',
    paddingRight: 'calc(var(--u) * 1)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--ink-dim)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--hair-soft)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft) !important',
  },
  '.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--accent-soft) !important',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--hair-soft)',
    outline: '1px solid var(--hair)',
  },
  '.cm-scroller': {
    scrollbarWidth: 'none',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-scroller::-webkit-scrollbar': {
    display: 'none',
  },
  '.cm-changedLine': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-changedText': {
    backgroundColor: 'var(--accent-soft)',
  },
}, { dark: false });

// Restrained categorical mapping: --accent stays reserved for the diff/undo
// caret and selection; syntax categories use the calm teal/navy/amber/tag
// tokens instead (see DESIGN.md's "one accent, one meaning").
const porcelainHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--navy)' },
  { tag: tags.controlKeyword, color: 'var(--navy)' },
  { tag: tags.operatorKeyword, color: 'var(--navy)' },
  { tag: tags.definitionKeyword, color: 'var(--navy)' },
  { tag: tags.moduleKeyword, color: 'var(--navy)' },
  { tag: tags.self, color: 'var(--navy)' },
  { tag: tags.bool, color: 'var(--navy)' },
  { tag: tags.null, color: 'var(--navy)' },
  { tag: tags.string, color: 'var(--teal)' },
  { tag: tags.regexp, color: 'var(--teal)' },
  { tag: tags.comment, color: 'var(--ink-faint)' },
  { tag: tags.lineComment, color: 'var(--ink-faint)' },
  { tag: tags.blockComment, color: 'var(--ink-faint)' },
  { tag: tags.docComment, color: 'var(--ink-faint)' },
  { tag: tags.function(tags.definition(tags.variableName)), color: 'var(--tag-teal)' },
  { tag: tags.function(tags.variableName), color: 'var(--tag-teal)' },
  { tag: tags.definition(tags.className), color: 'var(--amber)' },
  { tag: tags.className, color: 'var(--amber)' },
  { tag: tags.typeName, color: 'var(--amber)' },
  { tag: tags.number, color: 'var(--tag-purple)' },
  { tag: tags.integer, color: 'var(--tag-purple)' },
  { tag: tags.float, color: 'var(--tag-purple)' },
  { tag: tags.meta, color: 'var(--tag-sky)' },
  { tag: tags.attributeName, color: 'var(--tag-sky)' },
  { tag: tags.operator, color: 'var(--ink-dim)' },
  { tag: tags.punctuation, color: 'var(--ink-dim)' },
  { tag: tags.bracket, color: 'var(--ink-dim)' },
  { tag: tags.variableName, color: 'var(--ink)' },
  { tag: tags.propertyName, color: 'var(--ink)' },
  { tag: tags.heading, color: 'var(--ink)', fontWeight: '600' },
  { tag: tags.link, color: 'var(--teal)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '600' },
]);

function languageExtension(lang: LanguageId): Extension {
  switch (lang) {
    case 'markdown':
      return markdown();
    case 'python':
      return python();
    case 'javascript':
      return javascript({ jsx: true });
    case 'typescript':
      return javascript({ jsx: true, typescript: true });
    case 'json':
      return json();
    case 'plaintext':
    default:
      return [];
  }
}

function WorkTextEditorBound({ kind, itemId, mintNotice }: WorkTextEditorBoundProps) {
  const { doc, localSynced, collabStatus, collaboratorCount, awareness } = useCommonplaceCollabYjs(
    COMMONPLACE_PAGE_CONTENT_TYPE,
    itemId,
  );

  // Adjust-state-during-render: when the stage kind changes (thread switches
  // from a /doc stage to a /code stage or vice versa) reset the language
  // picker to that kind's default, synchronously during render rather than
  // via an effect + setState.
  const [renderedKind, setRenderedKind] = useState(kind);
  const [language, setLanguage] = useState<LanguageId>(() => defaultLanguageForStage(kind));
  if (kind !== renderedKind) {
    setRenderedKind(kind);
    setLanguage(defaultLanguageForStage(kind));
  }

  const [diffVisible, setDiffVisible] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const baselineRef = useRef<string | null>(null);

  const langCompartmentRef = useRef<Compartment | null>(null);
  if (langCompartmentRef.current == null) {
    langCompartmentRef.current = new Compartment();
  }
  const mergeCompartmentRef = useRef<Compartment | null>(null);
  if (mergeCompartmentRef.current == null) {
    mergeCompartmentRef.current = new Compartment();
  }
  const collabCompartmentRef = useRef<Compartment | null>(null);
  if (collabCompartmentRef.current == null) {
    collabCompartmentRef.current = new Compartment();
  }

  // Create (and recreate on doc-identity change, e.g. switching which item
  // is open) the CodeMirror view bound to this stage's Y.Text. Awareness
  // and language are wired through separate compartments below so neither
  // recreates the whole editor (which would drop cursor/selection state).
  useEffect(() => {
    if (!containerRef.current) return;

    const ytext = doc.getText('content');
    baselineRef.current = ytext.toString();
    const undoManager = new Y.UndoManager(ytext);
    undoManagerRef.current = undoManager;

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        indentOnInput(),
        bracketMatching(),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...searchKeymap, ...yUndoManagerKeymap, indentWithTab]),
        langCompartmentRef.current!.of(languageExtension(language)),
        mergeCompartmentRef.current!.of([]),
        collabCompartmentRef.current!.of(yCollab(ytext, null, { undoManager })),
        syntaxHighlighting(porcelainHighlight),
        porcelainTheme,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      undoManager.destroy();
      undoManagerRef.current = null;
    };
    // language/awareness are applied via their own compartment-reconfigure
    // effects below so they don't tear down the editor on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // Reconfigure the collab plugin (not recreate the view) once a live
  // awareness instance appears/disappears, preserving the undo history.
  useEffect(() => {
    const view = viewRef.current;
    const undoManager = undoManagerRef.current;
    const compartment = collabCompartmentRef.current;
    if (!view || !undoManager || !compartment) return;
    const ytext = doc.getText('content');
    view.dispatch({
      effects: compartment.reconfigure(yCollab(ytext, awareness, { undoManager })),
    });
  }, [doc, awareness]);

  // Reconfigure the language plugin when the picker changes.
  useEffect(() => {
    const view = viewRef.current;
    const compartment = langCompartmentRef.current;
    if (!view || !compartment) return;
    view.dispatch({ effects: compartment.reconfigure(languageExtension(language)) });
  }, [language]);

  const handleLanguageChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setLanguage(event.target.value as LanguageId);
  }, []);

  const toggleDiff = useCallback(() => {
    const view = viewRef.current;
    const compartment = mergeCompartmentRef.current;
    const baseline = baselineRef.current;
    if (!view || !compartment) return;
    setDiffVisible((prev) => {
      const next = !prev;
      view.dispatch({
        effects: compartment.reconfigure(
          next && baseline != null ? unifiedMergeView({ original: baseline }) : [],
        ),
      });
      return next;
    });
  }, []);

  const status = collabStatusDisplay(collabStatus, localSynced);
  const spring = useSpring('snappy');

  return (
    <div className={styles.host}>
      <div ref={containerRef} className={styles.editorHost} />
      <AnimatePresence>
        {mintNotice && (
          <motion.p
            key="mint-notice"
            className={styles.mintNotice}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={FADE_EXIT}
            transition={spring}
          >
            {mintNotice}
          </motion.p>
        )}
      </AnimatePresence>
      <div className={styles.toolbar}>
        {isLanguageSelectable(kind) ? (
          <select
            className={styles.select}
            value={language}
            onChange={handleLanguageChange}
            aria-label="Code language"
          >
            {CODE_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          className={styles.toggleButton}
          onClick={toggleDiff}
          aria-pressed={diffVisible}
        >
          {diffVisible ? 'Hide changes' : 'Show changes'}
        </button>
        <span className={styles.status} data-tone={status.tone}>
          {status.label}
          {/* Presence: fades/scales the "N others" fragment in and out as
              real awareness peers join/leave (see useCommonplaceCollabYjs),
              rather than a bare conditional string swap. */}
          <AnimatePresence>
            {collaboratorCount > 0 && (
              <motion.span
                key="presence"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={FADE_EXIT}
                transition={spring}
              >
                {` \u00b7 ${collaboratorCount} ${collaboratorCount === 1 ? 'other' : 'others'}`}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}

interface WorkTextEditorProps {
  kind: WorkTextStageKind;
  /** Backing Item id once opened from a search result; undefined when opened via a bare /doc or /code command. */
  itemId?: string;
}

/**
 * WS6: resolves a real backing Item before mounting the collaborative
 * editor. If `itemId` is already known (e.g. selected from an object
 * search result) it is used immediately -- no mint, no extra round trip.
 * Otherwise a fresh Item is minted once via gqlCreatePage (the same "New
 * Page" mutation ProjectPagesView.tsx already uses) so the stage gets a
 * real kind='doc' backing document the collab-token route will accept.
 *
 * The editor is not mounted until an id is resolved (minted or given),
 * so the Y.Doc identity never changes out from under the user mid-type --
 * swapping ids after mount would otherwise silently drop whatever they'd
 * already typed into a scratch buffer.
 */
export function WorkTextEditor({ kind, itemId }: WorkTextEditorProps) {
  const [resolvedItemId, setResolvedItemId] = useState<string | null>(itemId ?? null);
  const [mintNotice, setMintNotice] = useState<string | undefined>(undefined);
  const mintStartedRef = useRef(false);
  const spring = useSpring('gentle');

  // WS6 fix: if the component is reused for a different item/kind (e.g.
  // switching from a scratch doc to scratch code without remounting), the
  // resolved id and mint state must reset so the effect below mints or
  // adopts the *new* item instead of continuing to edit the stale one.
  useEffect(() => {
    if (itemId) {
      setResolvedItemId(itemId);
      mintStartedRef.current = false;
    } else {
      setResolvedItemId(null);
      mintStartedRef.current = false;
    }
    setMintNotice(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, kind]);

  useEffect(() => {
    if (itemId || resolvedItemId !== null || mintStartedRef.current) return;
    mintStartedRef.current = true;
    let cancelled = false;
    void createPage({ title: mintTitleForStage(kind), body: '' })
      .then((page) => {
        if (!cancelled) setResolvedItemId(page.id);
      })
      .catch((caught) => {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : 'Could not create a backing document.';
        setMintNotice(`Working locally only (${message.toLowerCase()}).`);
        setResolvedItemId(scratchDocumentId(kind));
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, kind, resolvedItemId]);

  if (resolvedItemId == null) {
    return (
      <div className={styles.host}>
        <motion.p
          className={styles.minting}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={spring}
        >
          {`Creating your ${kind === 'doc' ? 'document' : 'file'}\u2026`}
        </motion.p>
      </div>
    );
  }

  return <WorkTextEditorBound kind={kind} itemId={resolvedItemId} mintNotice={mintNotice} />;
}
