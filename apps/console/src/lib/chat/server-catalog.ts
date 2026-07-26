// SOURCING: none. Server-side chat catalog: process-global so reload and a
// second browser on the same instance see the same threads (CH9).

import { randomUUID } from 'node:crypto';
import type {
  ChatCatalog,
  ChatPersistedMessage,
  ChatProject,
  ChatThreadRecord,
} from '@/lib/chat/project-types';

const GLOBAL_KEY = Symbol.for('commonplace.console.chat-catalog');

interface CatalogStore {
  projects: Map<string, ChatProject>;
  threads: Map<string, ChatThreadRecord>;
  activeProjectId: string | null;
}

function store(): CatalogStore {
  const registry = globalThis as typeof globalThis & { [GLOBAL_KEY]?: CatalogStore };
  if (!registry[GLOBAL_KEY]) {
    const projectId = randomUUID();
    const project: ChatProject = {
      id: projectId,
      name: 'Default project',
      description: '',
      documentIds: [],
      objectTypes: ['person', 'task', 'project', 'org', 'doc', 'record'],
      updatedAt: Date.now(),
    };
    registry[GLOBAL_KEY] = {
      projects: new Map([[projectId, project]]),
      threads: new Map(),
      activeProjectId: projectId,
    };
  }
  return registry[GLOBAL_KEY]!;
}

export function readCatalog(): ChatCatalog {
  const current = store();
  return {
    projects: [...current.projects.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    threads: [...current.threads.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    activeProjectId: current.activeProjectId,
  };
}

export function setActiveProject(projectId: string): ChatCatalog {
  const current = store();
  if (!current.projects.has(projectId)) {
    throw new Error(`Unknown project: ${projectId}`);
  }
  current.activeProjectId = projectId;
  return readCatalog();
}

export function upsertProject(input: Partial<ChatProject> & { name?: string }): ChatProject {
  const current = store();
  const id = input.id ?? randomUUID();
  const existing = current.projects.get(id);
  const next: ChatProject = {
    id,
    name: input.name ?? existing?.name ?? 'Untitled project',
    description: input.description ?? existing?.description ?? '',
    documentIds: input.documentIds ?? existing?.documentIds ?? [],
    objectTypes: input.objectTypes ?? existing?.objectTypes ?? ['person', 'task', 'doc'],
    updatedAt: Date.now(),
  };
  current.projects.set(id, next);
  if (!current.activeProjectId) current.activeProjectId = id;
  return next;
}

export function createThread(input: {
  projectId?: string;
  title?: string;
  capability?: ChatThreadRecord['capability'];
  sessionId?: string | null;
}): ChatThreadRecord {
  const current = store();
  const projectId = input.projectId ?? current.activeProjectId;
  if (!projectId || !current.projects.has(projectId)) {
    throw new Error('No active project for the new thread.');
  }
  const id = randomUUID();
  const thread: ChatThreadRecord = {
    id,
    projectId,
    title: input.title ?? 'New thread',
    sessionId: input.sessionId ?? null,
    capability: input.capability ?? null,
    railCollapsed: false,
    updatedAt: Date.now(),
    scrollTop: 0,
    messages: [],
  };
  current.threads.set(id, thread);
  return thread;
}

export function getThread(threadId: string): ChatThreadRecord | null {
  return store().threads.get(threadId) ?? null;
}

export function updateThread(
  threadId: string,
  patch: Partial<Omit<ChatThreadRecord, 'id' | 'messages'>> & {
    messages?: ChatPersistedMessage[];
  },
): ChatThreadRecord {
  const current = store();
  const existing = current.threads.get(threadId);
  if (!existing) throw new Error(`Unknown thread: ${threadId}`);
  const next: ChatThreadRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    messages: patch.messages ?? existing.messages,
    updatedAt: Date.now(),
  };
  current.threads.set(threadId, next);
  return next;
}

export function replaceThreadMessages(
  threadId: string,
  messages: ChatPersistedMessage[],
): ChatThreadRecord {
  return updateThread(threadId, { messages });
}
