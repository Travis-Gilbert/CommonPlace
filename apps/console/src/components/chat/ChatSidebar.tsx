'use client';

// SOURCING: none. CH3: project sidebar; mode switcher, threads, projects,
// capabilities, project edit. Distinct from the console blocks sidebar.

import { useMemo, useState } from 'react';
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
import { cn } from '@/lib/cn';

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
}

export function ChatSidebar({
  catalog,
  activeThreadId,
  capabilities,
  unreachable = false,
  onCatalogChange,
  onOpenThread,
}: ChatSidebarProps) {
  const router = useRouter();
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const activeProject = catalog.projects.find((project) => project.id === catalog.activeProjectId) ?? null;

  const projectThreads = useMemo(() => {
    if (!activeProject) return [];
    return catalog.threads
      .filter((thread) => thread.projectId === activeProject.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [catalog.threads, activeProject]);

  const goConsole = () => {
    router.push(readLastConsoleViewPath());
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

  const launchCapability = async (capability: CapabilityItem) => {
    if (unreachable) return;
    const thread = await createChatThread({
      projectId: activeProject?.id,
      title: capability.name,
      capability: { kind: capability.kind, id: capability.id, name: capability.name },
    });
    onCatalogChange({
      ...catalog,
      threads: [thread, ...catalog.threads],
    });
    onOpenThread(thread.id);
  };

  const switchProject = async (projectId: string) => {
    if (unreachable) return;
    const next = await selectChatProject(projectId);
    onCatalogChange(next);
  };

  const saveProject = async (project: ChatProject) => {
    if (unreachable) return;
    const saved = await saveChatProject(project);
    onCatalogChange({
      ...catalog,
      projects: catalog.projects.map((item) => (item.id === saved.id ? saved : item)),
    });
    setEditingId(null);
  };

  return (
    <aside
      data-chat-sidebar
      className="flex h-full w-[min(280px,36vw)] shrink-0 flex-col border-r border-ij-seam bg-ij-frame"
    >
      <div
        data-mode-switcher
        className="m-2 grid grid-cols-2 gap-1 rounded-[var(--radius-control)] border border-ij-control-border p-1"
        role="tablist"
        aria-label="Console mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={false}
          className="rounded-[var(--radius-control)] px-2 py-1.5 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
          onClick={goConsole}
        >
          Home
        </button>
        <button
          type="button"
          role="tab"
          aria-selected
          className="rounded-[var(--radius-control)] bg-ij-raised px-2 py-1.5 text-ij-ink"
          style={{ fontWeight: 'var(--rec-weight-cap)' }}
        >
          Chat
        </button>
      </div>

      {unreachable ? (
        <p className="mx-2 mb-2 rounded-[var(--radius-control)] border border-ij-control-border px-2 py-2 text-ij-ink-info" role="status">
          Harness unreachable. Project edits and new threads are paused.
        </p>
      ) : null}

      <div className="px-2 pb-2">
        <button
          type="button"
          disabled={unreachable}
          onClick={() => void newThread()}
          className="h-ij-control w-full rounded-[var(--radius-control)] border border-ij-control-border text-ij-ink hover:bg-ij-hover-surface disabled:opacity-40"
        >
          New thread
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Project threads">
        <p className="mb-1 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Threads
        </p>
        <ul className="mb-4 grid gap-0.5">
          {projectThreads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              active={thread.id === activeThreadId}
              onOpen={() => onOpenThread(thread.id)}
            />
          ))}
          {projectThreads.length === 0 ? (
            <li className="px-2 py-1 text-ij-ink-disabled">No threads in this project yet.</li>
          ) : null}
        </ul>

        <p className="mb-1 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Projects
        </p>
        <ul className="mb-4 grid gap-1">
          {catalog.projects.map((project) => {
            const open = expandedProjects[project.id] ?? project.id === activeProject?.id;
            const threads = catalog.threads.filter((thread) => thread.projectId === project.id);
            return (
              <li key={project.id} className="rounded-[var(--radius-control)] border border-ij-seam">
                <div className="flex items-center gap-1 px-2 py-1">
                  <button
                    type="button"
                    className={cn(
                      'flex-1 truncate text-left',
                      project.id === activeProject?.id ? 'text-ij-ink' : 'text-ij-ink-info',
                    )}
                    onClick={() => void switchProject(project.id)}
                  >
                    {project.name}
                  </button>
                  <button
                    type="button"
                    aria-label={open ? 'Collapse project' : 'Expand project'}
                    onClick={() =>
                      setExpandedProjects((current) => ({ ...current, [project.id]: !open }))
                    }
                  >
                    {open ? '−' : '+'}
                  </button>
                  <button
                    type="button"
                    aria-label="Edit project"
                    disabled={unreachable}
                    onClick={() => setEditingId(project.id)}
                  >
                    ✎
                  </button>
                </div>
                {open ? (
                  <ul className="border-t border-ij-seam px-1 py-1">
                    {threads.map((thread) => (
                      <ThreadRow
                        key={thread.id}
                        thread={thread}
                        active={thread.id === activeThreadId}
                        onOpen={() => onOpenThread(thread.id)}
                      />
                    ))}
                  </ul>
                ) : null}
                {editingId === project.id ? (
                  <ProjectEditor
                    project={project}
                    onCancel={() => setEditingId(null)}
                    onSave={(next) => void saveProject(next)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="mb-1 text-ij-ink-info" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Capabilities
        </p>
        <ul className="grid gap-0.5">
          {capabilities.map((capability) => (
            <li key={`${capability.kind}:${capability.id}`}>
              <button
                type="button"
                disabled={unreachable}
                className="w-full truncate rounded-[var(--radius-control)] px-2 py-1 text-left text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink disabled:opacity-40"
                onClick={() => void launchCapability(capability)}
              >
                {capability.name}
              </button>
            </li>
          ))}
          {capabilities.length === 0 ? (
            <li className="px-2 py-1 text-ij-ink-disabled">No installed packs or skills yet.</li>
          ) : null}
        </ul>
      </nav>
    </aside>
  );
}

function ThreadRow({
  thread,
  active,
  onOpen,
}: {
  thread: ChatThreadRecord;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'w-full truncate rounded-[var(--radius-control)] px-2 py-1 text-left',
          active ? 'bg-ij-raised text-ij-ink' : 'text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink',
        )}
      >
        {thread.title}
      </button>
    </li>
  );
}

function ProjectEditor({
  project,
  onCancel,
  onSave,
}: {
  project: ChatProject;
  onCancel: () => void;
  onSave: (project: ChatProject) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [objectTypes, setObjectTypes] = useState(project.objectTypes.join(', '));
  const [documents, setDocuments] = useState(project.documentIds.join(', '));

  return (
    <div className="grid gap-2 border-t border-ij-seam p-2" data-project-editor>
      <label className="grid gap-1 text-ij-ink-info">
        Name
        <input
          className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-ij-ink-info">
        Description
        <textarea
          className="min-h-16 rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 py-1 text-ij-ink"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-ij-ink-info">
        Object types
        <input
          className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
          value={objectTypes}
          onChange={(event) => setObjectTypes(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-ij-ink-info">
        Attached documents
        <input
          className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
          value={documents}
          onChange={(event) => setDocuments(event.target.value)}
          placeholder="doc ids, comma separated"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className="h-ij-control flex-1 rounded-[var(--radius-control)] bg-ij-accent text-white"
          onClick={() =>
            onSave({
              ...project,
              name: name.trim() || project.name,
              description,
              objectTypes: objectTypes.split(',').map((value) => value.trim()).filter(Boolean),
              documentIds: documents.split(',').map((value) => value.trim()).filter(Boolean),
            })
          }
        >
          Save
        </button>
        <button
          type="button"
          className="h-ij-control rounded-[var(--radius-control)] border border-ij-control-border px-3 text-ij-ink-info"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
