// SOURCING: @commonplace/block-view object contract. Pure durable repository
// logic, with the authenticated transport injected by the server facade.

import { randomUUID } from 'node:crypto';
import type {
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectSet,
  Result,
} from '@commonplace/block-view/types';
import {
  activeProjectIdFromObject,
  catalogCreateAction,
  catalogUpdateAction,
  CHAT_CATALOG_TYPE,
  CHAT_PROJECT_TYPE,
  createProjectAction,
  DEFAULT_CATALOG_ID,
  DEFAULT_PROJECT_ID,
  projectFromObject,
  updateProjectAction,
} from './catalog-persistence';
import {
  CHAT_THREAD_TYPE,
  createThreadAction,
  threadFromObject,
  updateThreadAction,
} from './thread-persistence';
import type {
  ChatCatalog,
  ChatPersistedMessage,
  ChatProject,
  ChatThreadRecord,
} from './project-types';

const DEFAULT_OBJECT_TYPES = ['person', 'task', 'project', 'org', 'doc', 'record'];
const PAGE_SIZE = 500;

export interface ChatCatalogObjectSeam {
  query(query: ObjectQuery): Promise<ObjectSet>;
  emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>>;
}

function defaultProject(now: number): ChatProject {
  return {
    id: DEFAULT_PROJECT_ID,
    name: 'Default project',
    description: '',
    documentIds: [],
    objectTypes: [...DEFAULT_OBJECT_TYPES],
    updatedAt: now,
  };
}

async function requireEmit(
  seam: ChatCatalogObjectSeam,
  action: ObjectAction,
): Promise<ObjectActionReceipt> {
  const result = await seam.emit(action);
  if (!result.ok || !result.value || result.value.status !== 'applied') {
    const detail = result.error ?? result.value?.status ?? 'missing receipt';
    throw new Error(`chat catalog object action was not applied: ${detail}`);
  }
  return result.value;
}

export class DurableChatCatalog {
  constructor(
    private readonly seam: ChatCatalogObjectSeam,
    private readonly makeId: () => string = randomUUID,
    private readonly now: () => number = Date.now,
  ) {}

  private async readObjects(): Promise<ObjectSet['objects']> {
    const objects: ObjectSet['objects'][number][] = [];
    let cursor: string | undefined;
    do {
      const set = await this.seam.query({
        types: [CHAT_PROJECT_TYPE, CHAT_THREAD_TYPE, CHAT_CATALOG_TYPE],
        page: { limit: PAGE_SIZE, cursor },
      });
      objects.push(...set.objects);
      if (!set.next_cursor || set.next_cursor === cursor) break;
      cursor = set.next_cursor;
    } while (cursor);
    return objects;
  }

  async readCatalog(): Promise<ChatCatalog> {
    const objects = await this.readObjects();
    const projects = objects.flatMap((object) => {
      const project = projectFromObject(object);
      return project ? [project] : [];
    });
    const threads = objects.flatMap((object) => {
      const thread = threadFromObject(object);
      return thread ? [thread] : [];
    });
    const catalogObject = objects.find((object) => object.id === DEFAULT_CATALOG_ID);

    if (projects.length === 0) {
      const seeded = defaultProject(this.now());
      await requireEmit(this.seam, createProjectAction(seeded));
      projects.push(seeded);
    }

    const requestedActive = catalogObject
      ? activeProjectIdFromObject(catalogObject)
      : null;
    const activeProjectId = requestedActive
      && projects.some((project) => project.id === requestedActive)
      ? requestedActive
      : projects[0]!.id;
    if (!catalogObject) {
      await requireEmit(this.seam, catalogCreateAction(activeProjectId));
    } else if (requestedActive !== activeProjectId) {
      await requireEmit(this.seam, catalogUpdateAction(activeProjectId));
    }

    return {
      projects: projects.sort((a, b) => b.updatedAt - a.updatedAt),
      threads: threads.sort((a, b) => b.updatedAt - a.updatedAt),
      activeProjectId,
    };
  }

  async setActiveProject(projectId: string): Promise<ChatCatalog> {
    const catalog = await this.readCatalog();
    if (!catalog.projects.some((project) => project.id === projectId)) {
      throw new Error(`Unknown project: ${projectId}`);
    }
    await requireEmit(this.seam, catalogUpdateAction(projectId));
    return { ...catalog, activeProjectId: projectId };
  }

  async upsertProject(
    input: Partial<ChatProject> & { name?: string },
  ): Promise<ChatProject> {
    const catalog = await this.readCatalog();
    const id = input.id ?? `chat-project:${this.makeId()}`;
    const existing = catalog.projects.find((project) => project.id === id);
    const next: ChatProject = {
      id,
      name: input.name ?? existing?.name ?? 'Untitled project',
      description: input.description ?? existing?.description ?? '',
      documentIds: input.documentIds ?? existing?.documentIds ?? [],
      objectTypes: input.objectTypes ?? existing?.objectTypes ?? ['person', 'task', 'doc'],
      updatedAt: this.now(),
    };
    await requireEmit(
      this.seam,
      existing ? updateProjectAction(next) : createProjectAction(next),
    );
    return next;
  }

  async createThread(input: {
    projectId?: string;
    title?: string;
    capability?: ChatThreadRecord['capability'];
    sessionId?: string | null;
  }): Promise<ChatThreadRecord> {
    const catalog = await this.readCatalog();
    const projectId = input.projectId ?? catalog.activeProjectId;
    if (!projectId || !catalog.projects.some((project) => project.id === projectId)) {
      throw new Error('No active project for the new thread.');
    }
    const thread: ChatThreadRecord = {
      id: `chat-thread:${this.makeId()}`,
      projectId,
      title: input.title ?? 'New thread',
      sessionId: input.sessionId ?? null,
      sessionResumable: false,
      capability: input.capability ?? null,
      railCollapsed: false,
      updatedAt: this.now(),
      scrollTop: 0,
      messages: [],
    };
    await requireEmit(this.seam, createThreadAction(thread));
    return thread;
  }

  async getThread(threadId: string): Promise<ChatThreadRecord | null> {
    const set = await this.seam.query({
      types: [CHAT_THREAD_TYPE],
      where: { kind: 'eq', field: 'id', value: threadId },
      page: { limit: 1 },
    });
    return set.objects.flatMap((object) => {
      const thread = threadFromObject(object);
      return thread ? [thread] : [];
    })[0] ?? null;
  }

  async updateThread(
    threadId: string,
    patch: Partial<Omit<ChatThreadRecord, 'id' | 'messages' | 'sessionResumable'>> & {
      messages?: ChatPersistedMessage[];
    },
  ): Promise<ChatThreadRecord> {
    const existing = await this.getThread(threadId);
    if (!existing) throw new Error(`Unknown thread: ${threadId}`);
    const next: ChatThreadRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      sessionResumable: false,
      messages: patch.messages ?? existing.messages,
      updatedAt: this.now(),
    };
    await requireEmit(this.seam, updateThreadAction(next));
    return next;
  }

  replaceThreadMessages(
    threadId: string,
    messages: ChatPersistedMessage[],
  ): Promise<ChatThreadRecord> {
    return this.updateThread(threadId, { messages });
  }
}
