'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { toast } from 'sonner';
import NotebookTiptapEditor from '@/components/theseus/notebook/NotebookTiptapEditor';
import type { TiptapUpdatePayload } from '@/components/theseus/notebook/NotebookTiptapEditor';
import WordCountBand from '@/components/studio/WordCountBand';
import { useApiData } from '@/lib/commonplace-api';
import {
  gqlCreatePage,
  gqlPmOverview,
  gqlSavePage,
  type ItemGql,
  type PmOverviewGql,
  type PmWorkItemGql,
} from '@/lib/commonplace-graphql';
import { useCommonplaceCollabYjs } from '@/lib/useCommonplaceCollabYjs';
import { getBundle } from '@/lib/carry/bundle-store';
import { compileBundle } from '@/lib/carry/compile';
import { seededWriteBody, seededWriteTitle } from '@/lib/carry/seed-write';
import { appendRailEntry } from '@/lib/carry/session-rail';
import { SessionRail } from '@/components/commonplace/rail/SessionRail';
import { PublishAction } from '@/components/commonplace/publish/PublishAction';

interface ProjectPagesViewProps {
  projectId: string;
  /** Present when reached via Carry to Write: seed a page from this session's
   *  bundle (HANDOFF-CARRY D2). */
  carrySessionId?: string | null;
}

const EMPTY_OVERVIEW: PmOverviewGql = {
  projects: [],
  workItems: [],
  stickies: [],
  pages: [],
};

function pageText(page: ItemGql | null): string {
  return page?.bodyText ?? '';
}

function formatUpdated(ms: number): string {
  if (!ms) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

function sequenceLabel(workItem: PmWorkItemGql): string {
  return workItem.sequenceId ?? workItem.item.kind.toUpperCase();
}

function htmlToStoredText(html: string): string {
  return html === '<p></p>' ? '' : html;
}

export default function ProjectPagesView({ projectId, carrySessionId }: ProjectPagesViewProps) {
  const { data, loading, error, refetch } = useApiData<PmOverviewGql>(
    () => gqlPmOverview(projectId),
    [projectId],
    { cacheKey: `project:pages:${projectId}` },
  );
  const overview = data ?? EMPTY_OVERVIEW;
  const pages = overview.pages;
  const workItems = overview.workItems;
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [aboutItemId, setAboutItemId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedPageId = pages.some((page) => page.id === activePageId)
    ? activePageId
    : (pages[0]?.id ?? null);
  const activePage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  );

  const activeAboutItems = useMemo(() => {
    if (!activePage) return [];
    return workItems.filter((workItem) => workItem.aboutIds.includes(activePage.id));
  }, [activePage, workItems]);

  const createPage = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const page = await gqlCreatePage({
        projectId,
        aboutItemId: aboutItemId || undefined,
        title,
        body: '',
      });
      setNewTitle('');
      setAboutItemId('');
      setActivePageId(page.id);
      await refetch();
      toast.success('Page created');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not create page');
    } finally {
      setCreating(false);
    }
  }, [aboutItemId, newTitle, projectId, refetch]);

  // Carry to Write (C2.1/C2.4): when reached with a carry session, compile its
  // bundle and seed a new page of citation blocks, once per session id.
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!carrySessionId || seededRef.current === carrySessionId) return;
    seededRef.current = carrySessionId;
    let cancelled = false;
    void (async () => {
      const bundle = await getBundle(carrySessionId);
      if (!bundle || bundle.items.length === 0 || cancelled) return;
      const packet = await compileBundle(bundle);
      try {
        const page = await gqlCreatePage({
          projectId,
          title: seededWriteTitle(packet),
          body: seededWriteBody(packet),
        });
        if (cancelled) return;
        // Record the real seed on the traveling rail (the page id ties the
        // document back to the bundle, C2.4).
        await appendRailEntry(carrySessionId, {
          kind: 'destination',
          summary: `Seeded page with ${packet.records.length} cited ${packet.records.length === 1 ? 'source' : 'sources'}`,
          receipt: { pageId: page.id, projectId, bundleId: carrySessionId },
        });
        setActivePageId(page.id);
        await refetch();
        toast.success('Carried sources into a new page');
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : 'Could not seed carried page');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [carrySessionId, projectId, refetch]);

  if (loading) {
    return (
      <div className="cp-pages-view">
        <div className="cp-pages-shell">
          <div className="cp-loading-skeleton cp-pages-list-skeleton" />
          <div className="cp-loading-skeleton cp-pages-editor-skeleton" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-pages-view">
        <div className="cp-error-banner">
          <p>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error.message}`}
          </p>
          <button type="button" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-pages-view">
      <div className="cp-pages-toolbar">
        <div>
          <div className="cp-pm-kicker">Pages</div>
          <h3>Project knowledge</h3>
        </div>
        <form
          className="cp-pages-create"
          onSubmit={(event) => {
            event.preventDefault();
            void createPage();
          }}
        >
          <input
            className="cp-input"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="New page"
          />
          <select
            className="cp-input"
            value={aboutItemId}
            onChange={(event) => setAboutItemId(event.target.value)}
            aria-label="Link new page to work item"
          >
            <option value="">No linked work item</option>
            {workItems.map((workItem) => (
              <option key={workItem.item.id} value={workItem.item.id}>
                {sequenceLabel(workItem)} · {workItem.item.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="cp-pages-button"
            disabled={creating || !newTitle.trim()}
          >
            {creating ? 'Creating' : 'Create'}
          </button>
        </form>
      </div>

      {carrySessionId ? (
        <div className="cp-pages-carry-rail" style={{ padding: '0 1rem 0.75rem' }}>
          <SessionRail sessionId={carrySessionId} title="Carried into this page" defaultOpen />
        </div>
      ) : null}

      <div className="cp-pages-shell">
        <aside className="cp-pages-list" aria-label="Project pages">
          {pages.length === 0 ? (
            <div className="cp-pages-empty">
              <span>No pages yet.</span>
            </div>
          ) : (
            pages.map((page) => (
              <button
                key={page.id}
                type="button"
                className="cp-pages-list-item"
                data-selected={page.id === activePage?.id}
                onClick={() => setActivePageId(page.id)}
              >
                <span>{page.title || 'Untitled'}</span>
                <small>{formatUpdated(page.updatedAtMs)}</small>
              </button>
            ))
          )}
        </aside>

        <section className="cp-pages-editor-panel">
          {activePage ? (
            <ProjectPageEditor
              key={`${activePage.id}:${activePage.updatedAtMs}`}
              page={activePage}
              aboutItems={activeAboutItems}
              carrySessionId={carrySessionId}
              onSaved={(id) => {
                setActivePageId(id);
                void refetch();
              }}
            />
          ) : (
            <div className="cp-pages-empty cp-pages-empty-editor">
              <span>Create a page to start building the project wiki.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ProjectPageEditor({
  page,
  aboutItems,
  carrySessionId,
  onSaved,
}: {
  page: ItemGql;
  aboutItems: PmWorkItemGql[];
  carrySessionId?: string | null;
  onSaved: (id: string) => void;
}) {
  const [draftTitle, setDraftTitle] = useState(page.title);
  const [draftBody, setDraftBody] = useState(pageText(page));
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const {
    doc: yjsDoc,
    localSynced,
    editorSynced,
    collabEnabled,
    collabStatus,
    collaboratorCount,
  } = useCommonplaceCollabYjs('commonplace-page', page.id);
  const isDirty = draftTitle !== page.title || draftBody !== pageText(page);

  const handleUpdate = useCallback((payload: TiptapUpdatePayload) => {
    setDraftBody(htmlToStoredText(payload.html));
  }, []);

  const savePage = useCallback(async () => {
    if (!draftTitle.trim()) return;
    setSaving(true);
    try {
      const saved = await gqlSavePage({
        id: page.id,
        title: draftTitle,
        body: draftBody,
      });
      onSaved(saved.id);
      toast.success('Page saved');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not save page');
    } finally {
      setSaving(false);
    }
  }, [draftBody, draftTitle, onSaved, page.id]);

  return (
    <>
      <div className="cp-pages-editor-header">
        <input
          className="cp-pages-title-input"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          aria-label="Page title"
        />
        <div className="cp-pages-save-row">
          <span>
            {isDirty ? 'Unsaved' : `Saved ${formatUpdated(page.updatedAtMs)}`}
            {' · '}
            {localSynced ? 'local ready' : 'local sync'}
            {collabEnabled && (
              <>
                {' · '}
                {collabStatus}
                {collaboratorCount > 0 ? ` · ${collaboratorCount} live` : ''}
              </>
            )}
          </span>
          <PublishAction
            originId={page.id}
            artifactTitle={page.title}
            sessionId={carrySessionId}
          />
          <button
            type="button"
            className="cp-pages-button"
            disabled={!isDirty || saving || !draftTitle.trim()}
            onClick={() => void savePage()}
          >
            {saving ? 'Saving' : 'Save'}
          </button>
        </div>
      </div>

      {aboutItems.length > 0 && (
        <div className="cp-pages-about-row">
          {aboutItems.map((workItem) => (
            <span key={workItem.item.id}>
              {sequenceLabel(workItem)} · {workItem.item.title}
            </span>
          ))}
        </div>
      )}

      <div className="cp-pages-editor">
        <NotebookTiptapEditor
          initialContent={pageText(page)}
          initialContentFormat="html"
          onUpdate={handleUpdate}
          onEditorReady={setEditor}
          typewriterMode={false}
          placeholder="Start writing... Use / for commands"
          yjsDoc={yjsDoc}
          yjsSynced={editorSynced}
          activeSheetId={page.id}
        />
        <WordCountBand editor={editor} stageColor="#2d5f6b" />
      </div>
    </>
  );
}
