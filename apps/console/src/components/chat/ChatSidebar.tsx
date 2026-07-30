'use client';

// SOURCING: 21st/@jshguo/sidebar-component (TwoLevelSidebarShell).
// SPEC-COMMONPLACE-CHAT-SHELL-1.2 SH5/SH6: brand, search, panel. Dock removed;
// surface icons live on the outer rail. Main content flex-resizes with panel.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Analytics,
  Dashboard,
  DocumentAdd,
  Folder,
  Task,
} from '@carbon/icons-react';
import type {
  ChatCatalog,
  ChatProject,
  ChatThreadRecord,
} from '@/lib/chat/project-types';
import {
  createChatThread,
  saveChatProject,
  selectChatProject,
} from '@/lib/chat/catalog-client';
import { readLastConsoleViewPath } from '@/lib/chat/last-console-view';
import { ContextTree } from '@/components/chat/ContextTree';
import { TwoLevelSidebarShell } from '@/components/ui/sidebar-component';
import {
  IconSearch,
} from '@/components/shell/icons';
import type { ContextEntry, ContextFolder } from '@/lib/chat/context-types';

export type ChatDockSurface = 'home' | 'chat' | 'runs' | 'graph' | 'models';

export interface CapabilityItem {
  readonly kind: 'skill' | 'plugin';
  readonly id: string;
  readonly name: string;
}

export interface ChatSidebarProps {
  readonly catalog: ChatCatalog;
  readonly activeThreadId: string | null;
  readonly capabilities: readonly CapabilityItem[];
  readonly unreachable?: boolean;
  readonly onCatalogChange: (catalog: ChatCatalog) => void;
  readonly onOpenThread: (threadId: string) => void;
  readonly contextFolders?: readonly ContextFolder[];
  readonly onToggleContextInclude?: (entryId: string) => void;
  readonly surface?: ChatDockSurface;
  readonly onSurfaceChange?: (surface: ChatDockSurface) => void;
}

const PINNED_KEY = 'commonplace.chat.pinned-threads.v1';

function readPinned(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    // persistence-preference: key=commonplace.chat.pinned-threads.v1; preference=pinned threads; reason=restores the person's chat navigation
    const raw = window.localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writePinned(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    // persistence-preference: key=commonplace.chat.pinned-threads.v1; preference=pinned threads; reason=restores the person's chat navigation
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
  } catch {
    // Best-effort.
  }
}

const RAIL_ITEMS = [
  { id: 'home' as const, label: 'Home', icon: <Dashboard size={16} /> },
  { id: 'chat' as const, label: 'Chat', icon: <Task size={16} /> },
  { id: 'runs' as const, label: 'Runs', icon: <Folder size={16} /> },
  { id: 'graph' as const, label: 'Graph', icon: <Analytics size={16} /> },
  { id: 'models' as const, label: 'Models', icon: <DocumentAdd size={16} /> },
];

export function ChatSidebar({
  catalog,
  activeThreadId,
  capabilities,
  unreachable = false,
  onCatalogChange,
  onOpenThread,
  contextFolders = [],
  onToggleContextInclude,
  surface: surfaceProp,
  onSurfaceChange,
}: ChatSidebarProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [surfaceState, setSurfaceState] = useState<ChatDockSurface>('chat');
  const surface = surfaceProp ?? surfaceState;
  const setSurface = (next: ChatDockSurface) => {
    onSurfaceChange?.(next);
    if (surfaceProp === undefined) setSurfaceState(next);
  };
  const router = useRouter();

  const goSurface = (next: ChatDockSurface) => {
    setSurface(next);
    if (next === 'home') {
      router.push(readLastConsoleViewPath());
      return;
    }
    if (next === 'chat') {
      if (activeThreadId) router.push(`/chat/${encodeURIComponent(activeThreadId)}`);
      else router.push('/chat');
      return;
    }
    if (next === 'runs') {
      router.push('/threads');
      return;
    }
    if (next === 'graph') {
      router.push('/indexer');
      return;
    }
    if (next === 'models') {
      router.push('/Data-model');
    }
  };

  return (
    <TwoLevelSidebarShell
      data-testid="chat-sidebar"
      items={RAIL_ITEMS}
      activeSection={surface}
      onSectionChange={(id) => goSurface(id as ChatDockSurface)}
      panelOpen={panelOpen}
      onPanelOpenChange={setPanelOpen}
      title={surface === 'chat' ? 'Chat' : surface.charAt(0).toUpperCase() + surface.slice(1)}
      panel={
        <ChatSidebarPanel
          catalog={catalog}
          activeThreadId={activeThreadId}
          capabilities={capabilities}
          unreachable={unreachable}
          onCatalogChange={onCatalogChange}
          onOpenThread={onOpenThread}
          contextFolders={contextFolders}
          onToggleContextInclude={onToggleContextInclude}
          surface={surface}
        />
      }
    />
  );
}

function ChatSidebarPanel({
  catalog,
  activeThreadId,
  capabilities,
  unreachable,
  onCatalogChange,
  onOpenThread,
  contextFolders,
  onToggleContextInclude,
  surface,
}: {
  catalog: ChatCatalog;
  activeThreadId: string | null;
  capabilities: readonly CapabilityItem[];
  unreachable: boolean;
  onCatalogChange: (catalog: ChatCatalog) => void;
  onOpenThread: (threadId: string) => void;
  contextFolders: readonly ContextFolder[];
  onToggleContextInclude?: (entryId: string) => void;
  surface: ChatDockSurface;
}) {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const activeProject = catalog.projects.find((project) => project.id === catalog.activeProjectId) ?? null;
  const activeThread = catalog.threads.find((thread) => thread.id === activeThreadId) ?? null;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPinnedIds(readPinned()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const pinnedThreads = useMemo(() => {
    const byId = new Map(catalog.threads.map((thread) => [thread.id, thread]));
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((thread): thread is ChatThreadRecord => Boolean(thread))
      .filter((thread) => thread.id !== activeThreadId);
  }, [catalog.threads, pinnedIds, activeThreadId]);

  const filteredPinned = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return pinnedThreads;
    return pinnedThreads.filter((thread) => thread.title.toLowerCase().includes(needle));
  }, [pinnedThreads, query]);

  const newThread = async () => {
    if (unreachable) return;
    const thread = await createChatThread({
      projectId: activeProject?.id,
      title: 'New thread',
    });
    onCatalogChange({
      ...catalog,
      threads: [thread, ...catalog.threads],
    });
    onOpenThread(thread.id);
  };

  const togglePin = (threadId: string) => {
    setPinnedIds((current) => {
      const next = current.includes(threadId)
        ? current.filter((id) => id !== threadId)
        : [...current, threadId];
      writePinned(next);
      return next;
    });
  };

  const openPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col" data-chat-sidebar>
      <div className="flex items-center gap-2 border-b border-[color:var(--paper-seam,var(--ij-seam))] px-1 py-2" data-sidebar-brand>
        <div className="min-w-0 flex-1">
          <p className="truncate text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            {activeProject?.name ?? 'CommonPlace'}
          </p>
          <p className="truncate text-ij-ink-disabled" style={{ fontSize: 'var(--ij-composer-meta-font-size)' }}>
            Workspace
          </p>
        </div>
      </div>

      <div className="border-b border-[color:var(--paper-seam,var(--ij-seam))] px-1 py-2" data-sidebar-search>
        <label className="flex h-ij-control items-center gap-2 rounded-[var(--radius-control)] border border-ij-control-border bg-[color:var(--paper-lifted,var(--ij-editor))] px-2">
          <IconSearch size={14} className="text-ij-ink-info" />
          <input
            className="min-w-0 flex-1 bg-transparent text-ij-ink outline-none placeholder:text-ij-ink-disabled"
            placeholder="Search threads"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                openPalette();
              }
            }}
          />
          <button
            type="button"
            className="font-ij-mono text-ij-ink-disabled"
            style={{ fontSize: 'var(--ij-composer-meta-font-size)' }}
            onClick={openPalette}
            aria-label="Open command palette"
          >
            ⌘K
          </button>
        </label>
      </div>

      {capabilities.length > 0 ? (
        <div className="flex flex-wrap gap-1 border-b border-[color:var(--paper-seam,var(--ij-seam))] px-1 py-2" data-sidebar-capabilities>
          {capabilities.map((capability) => (
            <span
              key={capability.id}
              className="rounded-[var(--radius-control)] border border-ij-control-border px-2 py-0.5 text-ij-ink-info"
              style={{ fontSize: 'var(--ij-composer-meta-font-size)' }}
            >
              {capability.name}
            </span>
          ))}
        </div>
      ) : null}

      {unreachable ? (
        <p className="mx-1 mt-2 rounded-[var(--radius-control)] border border-ij-control-border px-2 py-2 text-ij-ink-info" role="status">
          Harness unreachable. Project edits and new threads are paused.
        </p>
      ) : null}

      <nav className="min-h-0 flex-1 overflow-y-auto px-1 py-3" aria-label="Chat panel">
        {surface === 'chat' ? (
          <>
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                  Current
                </p>
                <button
                  type="button"
                  disabled={unreachable}
                  onClick={() => void newThread()}
                  className="text-ij-ink-info hover:text-ij-ink disabled:opacity-40"
                  style={{ fontSize: 'var(--ij-composer-meta-font-size)' }}
                >
                  New
                </button>
              </div>
              {activeThread ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate rounded-[var(--radius-control)] bg-[color:var(--paper-sunken,var(--ij-editor))] px-2 py-1.5 text-left text-ij-ink shadow-[inset_0_0_0_1px_var(--ij-seam)]"
                    onClick={() => onOpenThread(activeThread.id)}
                  >
                    {activeThread.title}
                  </button>
                  <button
                    type="button"
                    aria-label={pinnedIds.includes(activeThread.id) ? 'Unpin thread' : 'Pin thread'}
                    className="rounded-[var(--radius-control)] px-2 py-1 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
                    onClick={() => togglePin(activeThread.id)}
                  >
                    {pinnedIds.includes(activeThread.id) ? '★' : '☆'}
                  </button>
                </div>
              ) : (
                <p className="px-2 py-1 text-ij-ink-disabled">No open thread.</p>
              )}
            </div>

            <div className="mb-3">
              <p className="mb-1 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                Pinned
              </p>
              <ul className="grid gap-0.5">
                {filteredPinned.map((thread) => (
                  <li key={thread.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenThread(thread.id)}
                      className="min-w-0 flex-1 truncate rounded-[var(--radius-control)] px-2 py-1 text-left text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
                    >
                      {thread.title}
                    </button>
                    <button
                      type="button"
                      aria-label="Unpin thread"
                      className="px-2 text-ij-ink-info hover:text-ij-ink"
                      onClick={() => togglePin(thread.id)}
                    >
                      ★
                    </button>
                  </li>
                ))}
                {filteredPinned.length === 0 ? (
                  <li className="px-2 py-1 text-ij-ink-disabled">No pinned threads.</li>
                ) : null}
              </ul>
            </div>

            <div>
              <p className="mb-1 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                Context
              </p>
              <ContextTree
                folders={contextFolders}
                onToggleInclude={onToggleContextInclude ?? (() => {})}
              />
            </div>

            {activeProject ? (
              <ProjectEditorInline
                key={`${activeProject.id}:${activeProject.name}:${activeProject.description}`}
                project={activeProject}
                unreachable={unreachable}
                onSave={async (project) => {
                  const saved = await saveChatProject(project);
                  onCatalogChange({
                    ...catalog,
                    projects: catalog.projects.map((item) => (item.id === saved.id ? saved : item)),
                  });
                }}
                onSelect={async (projectId) => {
                  const next = await selectChatProject(projectId);
                  onCatalogChange(next);
                }}
                projects={catalog.projects}
              />
            ) : null}
          </>
        ) : (
          <p className="px-2 py-1 text-ij-ink-info">
            {surface === 'runs' && 'Runs open in the threads surface.'}
            {surface === 'graph' && 'Graph opens the indexer.'}
            {surface === 'models' && 'Models open the models surface.'}
            {surface === 'home' && 'Returning to the console home.'}
          </p>
        )}
      </nav>
    </div>
  );
}

function ProjectEditorInline({
  project,
  projects,
  unreachable,
  onSave,
  onSelect,
}: {
  project: ChatProject;
  projects: readonly ChatProject[];
  unreachable: boolean;
  onSave: (project: ChatProject) => Promise<void>;
  onSelect: (projectId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);

  return (
    <div className="mt-4 border-t border-[color:var(--paper-seam,var(--ij-seam))] pt-3" data-project-panel>
      <button
        type="button"
        className="mb-2 w-full text-left text-ij-ink-info hover:text-ij-ink"
        style={{ fontWeight: 'var(--rec-weight-cap)' }}
        onClick={() => setOpen((value) => !value)}
      >
        Projects {open ? '−' : '+'}
      </button>
      {open ? (
        <div className="grid gap-2">
          <label className="grid gap-1 text-ij-ink-info">
            Active project
            <select
              className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border bg-[color:var(--paper-lifted,var(--ij-editor))] px-2 text-ij-ink"
              value={project.id}
              disabled={unreachable}
              onChange={(event) => void onSelect(event.target.value)}
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-ij-ink-info">
            Name
            <input
              className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border bg-[color:var(--paper-lifted,var(--ij-editor))] px-2 text-ij-ink"
              value={name}
              disabled={unreachable}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-ij-ink-info">
            Description
            <textarea
              className="min-h-16 rounded-[var(--radius-control)] border border-ij-control-border bg-[color:var(--paper-lifted,var(--ij-editor))] px-2 py-1 text-ij-ink"
              value={description}
              disabled={unreachable}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={unreachable}
            className="h-ij-control rounded-[var(--radius-control)] bg-ij-accent text-white disabled:opacity-40"
            onClick={() =>
              void onSave({
                ...project,
                name: name.trim() || project.name,
                description,
              })
            }
          >
            Save project
          </button>
        </div>
      ) : null}
    </div>
  );
}

export type { ContextEntry };
