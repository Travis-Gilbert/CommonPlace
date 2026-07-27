'use client';

// SOURCING: none. SPEC-COMMONPLACE-CHAT-SHELL-1.2 SH5/SH6: one sidebar, four
// bands (brand, search, dock, panel). Dock is the sole surface switcher.
// Chat panel: Current, Pinned, Context. No second icon rail.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Dock, DockIcon, DockItem, DockLabel } from '@/components/ui/dock';
import {
  IconAccount,
  IconChat,
  IconIndex,
  IconModel,
  IconRun,
  IconSearch,
  IconWorkspace,
} from '@/components/shell/icons';
import type { ContextEntry, ContextFolder } from '@/lib/chat/context-types';
import { cn } from '@/lib/cn';

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
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
  } catch {
    // Best-effort.
  }
}

export function ChatSidebar({
  catalog,
  activeThreadId,
  capabilities: _capabilities,
  unreachable = false,
  onCatalogChange,
  onOpenThread,
  contextFolders = [],
  onToggleContextInclude,
  surface: surfaceProp,
  onSurfaceChange,
}: ChatSidebarProps) {
  const router = useRouter();
  const [surfaceState, setSurfaceState] = useState<ChatDockSurface>('chat');
  const surface = surfaceProp ?? surfaceState;
  const setSurface = (next: ChatDockSurface) => {
    onSurfaceChange?.(next);
    if (surfaceProp === undefined) setSurfaceState(next);
  };
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const activeProject = catalog.projects.find((project) => project.id === catalog.activeProjectId) ?? null;
  const activeThread = catalog.threads.find((thread) => thread.id === activeThreadId) ?? null;

  useEffect(() => {
    setPinnedIds(readPinned());
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

  const goSurface = (next: ChatDockSurface) => {
    setSurface(next);
    if (next === 'home') {
      router.push(readLastConsoleViewPath());
      return;
    }
    if (next === 'chat') {
      if (activeThreadId) router.push(`/chat/${activeThreadId}`);
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
      router.push('/models');
    }
  };

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
    <aside
      data-chat-sidebar
      className="flex h-full shrink-0 flex-col border-r border-ij-seam bg-ij-frame"
      style={{ width: 'var(--ij-chat-sidebar-w)' }}
    >
      {/* Band 1: brand and account */}
      <div className="flex items-center gap-2 border-b border-ij-seam px-3 py-2" data-sidebar-brand>
        <IconWorkspace size={16} className="text-ij-ink" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            {activeProject?.name ?? 'CommonPlace'}
          </p>
          <p className="truncate text-ij-ink-disabled" style={{ fontSize: 'var(--ij-composer-meta-font-size)' }}>
            Workspace
          </p>
        </div>
        <IconAccount size={16} className="text-ij-ink-info" aria-hidden />
      </div>

      {/* Band 2: search */}
      <div className="border-b border-ij-seam px-2 py-2" data-sidebar-search>
        <label className="flex h-ij-control items-center gap-2 rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2">
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

      {/* Band 3: dock (sole navigation control) */}
      <div className="border-b border-ij-seam px-1 py-2" data-sidebar-dock>
        <Dock panelHeight={36} magnification={44} distance={100}>
          <DockItem
            aria-label="Home"
            aria-current={surface === 'home' ? 'page' : undefined}
            onClick={() => goSurface('home')}
            className={cn(surface === 'home' && 'text-ij-ink')}
          >
            <DockLabel>Home</DockLabel>
            <DockIcon>
              <IconWorkspace size={16} className={surface === 'home' ? 'opacity-100' : 'opacity-60'} />
            </DockIcon>
          </DockItem>
          <DockItem
            aria-label="Chat"
            aria-current={surface === 'chat' ? 'page' : undefined}
            onClick={() => goSurface('chat')}
          >
            <DockLabel>Chat</DockLabel>
            <DockIcon>
              <IconChat size={16} className={surface === 'chat' ? 'opacity-100' : 'opacity-60'} />
            </DockIcon>
          </DockItem>
          <DockItem
            aria-label="Runs"
            aria-current={surface === 'runs' ? 'page' : undefined}
            onClick={() => goSurface('runs')}
          >
            <DockLabel>Runs</DockLabel>
            <DockIcon>
              <IconRun size={16} className={surface === 'runs' ? 'opacity-100' : 'opacity-60'} />
            </DockIcon>
          </DockItem>
          <DockItem
            aria-label="Graph"
            aria-current={surface === 'graph' ? 'page' : undefined}
            onClick={() => goSurface('graph')}
          >
            <DockLabel>Graph</DockLabel>
            <DockIcon>
              <IconIndex size={16} className={surface === 'graph' ? 'opacity-100' : 'opacity-60'} />
            </DockIcon>
          </DockItem>
          <DockItem
            aria-label="Models"
            aria-current={surface === 'models' ? 'page' : undefined}
            onClick={() => goSurface('models')}
          >
            <DockLabel>Models</DockLabel>
            <DockIcon>
              <IconModel size={16} className={surface === 'models' ? 'opacity-100' : 'opacity-60'} />
            </DockIcon>
          </DockItem>
        </Dock>
      </div>

      {unreachable ? (
        <p className="mx-2 mt-2 rounded-[var(--radius-control)] border border-ij-control-border px-2 py-2 text-ij-ink-info" role="status">
          Harness unreachable. Project edits and new threads are paused.
        </p>
      ) : null}

      {/* Band 4: panel (Chat: Current / Pinned / Context) */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Chat panel">
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
                    className="min-w-0 flex-1 truncate rounded-[var(--radius-control)] bg-ij-raised px-2 py-1.5 text-left text-ij-ink"
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
    </aside>
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

  useEffect(() => {
    setName(project.name);
    setDescription(project.description);
  }, [project.id, project.name, project.description]);

  return (
    <div className="mt-4 border-t border-ij-seam pt-3" data-project-panel>
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
              className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
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
              className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
              value={name}
              disabled={unreachable}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-ij-ink-info">
            Description
            <textarea
              className="min-h-16 rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 py-1 text-ij-ink"
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

// Re-export for callers that still expect ContextEntry at the sidebar boundary.
export type { ContextEntry };
