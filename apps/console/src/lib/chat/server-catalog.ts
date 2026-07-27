// SOURCING: @commonplace/block-view object contract. The server catalog is a
// compatibility facade over the authenticated object seam, not process memory.

import type {
  ObjectAction,
  ObjectActionReceipt,
  ObjectSet,
  Result,
} from '@commonplace/block-view/types';
import { forward } from '@/app/api/objects/_upstream';
import {
  DurableChatCatalog,
  type ChatCatalogObjectSeam,
} from './catalog-repository';
import type {
  ChatPersistedMessage,
  ChatProject,
  ChatThreadRecord,
} from './project-types';

async function responseError(response: Response, operation: string): Promise<Error> {
  const body = await response.json().catch(() => null) as {
    error?: unknown;
    message?: unknown;
  } | null;
  const reason = typeof body?.message === 'string'
    ? body.message
    : typeof body?.error === 'string'
      ? body.error
      : `${operation} failed: ${response.status}`;
  return new Error(reason);
}

const authenticatedObjectSeam: ChatCatalogObjectSeam = {
  async query(query) {
    const response = await forward('/objects/query', {
      method: 'POST',
      body: JSON.stringify(query),
    });
    if (!response.ok) throw await responseError(response, 'chat catalog query');
    const set = await response.json() as Omit<ObjectSet, 'subscribe'>;
    return { ...set, subscribe: () => () => {} };
  },
  async emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    const response = await forward('/objects/action', {
      method: 'POST',
      body: JSON.stringify(action),
    });
    if (!response.ok) {
      const error = await responseError(response, 'chat catalog action');
      return { ok: false, error: error.message };
    }
    return {
      ok: true,
      value: await response.json() as ObjectActionReceipt,
    };
  },
};

const catalog = new DurableChatCatalog(authenticatedObjectSeam);

export const readCatalog = () => catalog.readCatalog();
export const setActiveProject = (projectId: string) => catalog.setActiveProject(projectId);
export const upsertProject = (input: Partial<ChatProject> & { name?: string }) => (
  catalog.upsertProject(input)
);
export const createThread = (input: {
  projectId?: string;
  title?: string;
  capability?: ChatThreadRecord['capability'];
  sessionId?: string | null;
}) => catalog.createThread(input);
export const getThread = (threadId: string) => catalog.getThread(threadId);
export const updateThread = (
  threadId: string,
  patch: Partial<Omit<ChatThreadRecord, 'id' | 'messages' | 'sessionResumable'>> & {
    messages?: ChatPersistedMessage[];
  },
) => catalog.updateThread(threadId, patch);
export const replaceThreadMessages = (
  threadId: string,
  messages: ChatPersistedMessage[],
) => catalog.replaceThreadMessages(threadId, messages);
