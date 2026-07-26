// SOURCING: none. Client catalog client for chat projects and threads (CH3/CH9).

import type {
  ChatCatalog,
  ChatPersistedMessage,
  ChatProject,
  ChatThreadRecord,
} from '@/lib/chat/project-types';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `chat catalog failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchChatCatalog(): Promise<ChatCatalog> {
  const response = await fetch('/api/chat/projects', { cache: 'no-store' });
  return readJson<ChatCatalog>(response);
}

export async function saveChatProject(
  project: Partial<ChatProject> & { name?: string },
): Promise<ChatProject> {
  const response = await fetch('/api/chat/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return readJson<ChatProject>(response);
}

export async function selectChatProject(projectId: string): Promise<ChatCatalog> {
  const response = await fetch('/api/chat/projects', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activeProjectId: projectId }),
  });
  return readJson<ChatCatalog>(response);
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
  return readJson<ChatThreadRecord>(response);
}

export async function fetchChatThread(threadId: string): Promise<ChatThreadRecord> {
  const response = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}`, {
    cache: 'no-store',
  });
  return readJson<ChatThreadRecord>(response);
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
  return readJson<ChatThreadRecord>(response);
}

export async function persistChatMessages(
  threadId: string,
  messages: ChatPersistedMessage[],
): Promise<ChatThreadRecord> {
  return persistChatThread(threadId, { messages });
}
