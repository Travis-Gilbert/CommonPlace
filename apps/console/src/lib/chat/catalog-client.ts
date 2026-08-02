// SOURCING: none. Client catalog client for chat projects and threads (CH3/CH9).

import type {
  ChatCatalog,
  ChatPersistedMessage,
  ChatProject,
  ChatThreadRecord,
} from '@/lib/chat/project-types';

/**
 * A chat-route failure that keeps its evidence instead of flattening it into a
 * string.
 *
 * These routes are the console's own (`/api/chat/*`). They are NOT the data
 * API. Throwing a bare Error meant the caller had nothing but a message to go
 * on, so ChatPage labelled every one of them "The data API is unreachable." and
 * pointed the reader at a service that was answering fine.
 */
export class ChatWireError extends Error {
  /** The console route dialed, e.g. '/api/chat/projects'. */
  readonly door: string;
  /** HTTP status, or null when the request never landed at all. */
  readonly status: number | null;
  /** The wire code the route named, when it named one. */
  readonly wireCode: string | null;

  constructor(options: {
    message: string;
    door: string;
    status: number | null;
    wireCode?: string | null;
  }) {
    super(options.message);
    this.name = 'ChatWireError';
    this.door = options.door;
    this.status = options.status;
    this.wireCode = options.wireCode ?? null;
  }
}

async function readJson<T>(response: Response, door: string): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new ChatWireError({
      message: body.message ?? body.error ?? `chat request failed: ${response.status}`,
      door,
      status: response.status,
      wireCode: body.error ?? null,
    });
  }
  return response.json() as Promise<T>;
}

export async function fetchChatCatalog(): Promise<ChatCatalog> {
  const response = await fetch('/api/chat/projects', { cache: 'no-store' });
  return readJson<ChatCatalog>(response, '/api/chat/projects');
}

export async function saveChatProject(
  project: Partial<ChatProject> & { name?: string },
): Promise<ChatProject> {
  const response = await fetch('/api/chat/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return readJson<ChatProject>(response, '/api/chat/projects');
}

export async function selectChatProject(projectId: string): Promise<ChatCatalog> {
  const response = await fetch('/api/chat/projects', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activeProjectId: projectId }),
  });
  return readJson<ChatCatalog>(response, '/api/chat/projects');
}

export async function createChatThread(input: {
  projectId?: string;
  title?: string;
  capability?: ChatThreadRecord['capability'];
}): Promise<ChatThreadRecord> {
  const response = await fetch('/api/chat/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readJson<ChatThreadRecord>(response, '/api/chat/threads');
}

export async function fetchChatThread(threadId: string): Promise<ChatThreadRecord> {
  const response = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
    cache: 'no-store',
  });
  return readJson<ChatThreadRecord>(response, `/api/chat/threads/${encodeURIComponent(threadId)}`);
}

export async function persistChatThread(
  threadId: string,
  patch: Partial<ChatThreadRecord>,
): Promise<ChatThreadRecord> {
  const response = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return readJson<ChatThreadRecord>(response, `/api/chat/threads/${encodeURIComponent(threadId)}`);
}

export async function persistChatMessages(
  threadId: string,
  messages: ChatPersistedMessage[],
): Promise<ChatThreadRecord> {
  return persistChatThread(threadId, { messages });
}
