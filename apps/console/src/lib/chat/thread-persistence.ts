// SOURCING: @commonplace/block-view object contract. A chat transcript is one
// durable object; the hosted conversational session remains a separate runtime
// capability and is never inferred from this stored record.

import type {
  JsonValue,
  ObjectAction,
  ObjectRef,
} from '@commonplace/block-view/types';
import type {
  ChatArtifactPayload,
  ChatPersistedMessage,
  ChatThreadRecord,
} from './project-types';

export const CHAT_THREAD_TYPE = 'chat-thread';

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: JsonValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function capabilityValue(
  value: JsonValue | undefined,
): ChatThreadRecord['capability'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Readonly<Record<string, JsonValue>>;
  if (
    (candidate.kind !== 'skill' && candidate.kind !== 'plugin')
    || typeof candidate.id !== 'string'
    || typeof candidate.name !== 'string'
  ) {
    return null;
  }
  return {
    kind: candidate.kind,
    id: candidate.id,
    name: candidate.name,
  };
}

function artifactValue(value: JsonValue | undefined): ChatArtifactPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as unknown as ChatArtifactPayload;
  return typeof candidate.kind === 'string' ? candidate : null;
}

function messagesValue(value: JsonValue | undefined): ChatPersistedMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const message = entry as Readonly<Record<string, JsonValue>>;
    if (
      typeof message.id !== 'string'
      || (message.role !== 'user' && message.role !== 'assistant')
      || typeof message.text !== 'string'
    ) {
      return [];
    }
    return [{
      id: message.id,
      role: message.role,
      text: message.text,
      incomplete: message.incomplete === true,
      artifact: artifactValue(message.artifact),
    }];
  });
}

export function threadFromObject(object: ObjectRef): ChatThreadRecord | null {
  if (object.type !== CHAT_THREAD_TYPE) return null;
  const projectId = stringValue(object.properties.projectId);
  if (!projectId) return null;
  return {
    id: object.id,
    projectId,
    title: stringValue(object.properties.title) ?? 'New thread',
    sessionId: stringValue(object.properties.sessionId) ?? null,
    // A stored transcript and session id do not prove the remote ACP provider
    // can reconstruct conversational state after its own restart.
    sessionResumable: false,
    capability: capabilityValue(object.properties.capability),
    railCollapsed: object.properties.railCollapsed === true,
    updatedAt: numberValue(
      object.properties.updatedAt,
      numberValue(object.properties.updated_at_ms, 0),
    ),
    scrollTop: numberValue(object.properties.scrollTop, 0),
    messages: messagesValue(object.properties.messages),
  };
}

export function threadProperties(
  thread: ChatThreadRecord,
): Readonly<Record<string, JsonValue>> {
  return {
    id: thread.id,
    title: thread.title,
    projectId: thread.projectId,
    sessionId: thread.sessionId,
    sessionResumable: false,
    capability: thread.capability as unknown as JsonValue,
    railCollapsed: thread.railCollapsed,
    updatedAt: thread.updatedAt,
    scrollTop: thread.scrollTop,
    messages: thread.messages as unknown as JsonValue,
    persistence_kind: 'chat-transcript-v1',
  };
}

export function createThreadAction(thread: ChatThreadRecord): ObjectAction {
  return {
    kind: 'create',
    type: CHAT_THREAD_TYPE,
    props: threadProperties(thread),
  };
}

export function updateThreadAction(thread: ChatThreadRecord): ObjectAction {
  const { id: _id, ...patch } = threadProperties(thread);
  return { kind: 'update', id: thread.id, patch };
}
