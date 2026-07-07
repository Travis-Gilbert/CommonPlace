/**
 * Pure message-list transitions for the WS1 work thread.
 *
 * Framework-free (no React, no Yjs) so every transition is a plain
 * function of (messages, event) -> messages, fully unit-testable. The
 * React/Yjs glue (use-work-thread.ts) calls these functions and writes
 * the result back into a Y.Array inside a doc.transact().
 */

import type { StageEvent, AsyncStreamHandlers } from '@/lib/theseus-api';
import type { TheseusResponse } from '@/lib/theseus-types';
import type { ThreadMessageLike } from '@assistant-ui/react';
import type { JsonValue } from '@/lib/block-view/types';
import type { WorkMessage, WorkToolPart } from './types';

let counter = 0;

/** Monotonic id generator. Exported so tests can seed deterministic ids. */
export function nextWorkMessageId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/** Stable tool name per Theseus pipeline stage. See StageEvent in theseus-api.ts. */
const STAGE_TOOL_NAME: Record<StageEvent['name'], string> = {
  pipeline_start: 'pipeline',
  e4b_classify_start: 'classify',
  e4b_classify_complete: 'classify',
  retrieval_start: 'retrieval',
  retrieval_complete: 'retrieval',
  objects_loaded: 'objects',
  simulation_assembling: 'simulation',
  expression_start: 'expression',
  expression_complete: 'expression',
};

/** Stages that carry a finished payload (vs. a bare "started" marker). */
const STAGE_IS_TERMINAL: Record<StageEvent['name'], boolean> = {
  pipeline_start: false,
  e4b_classify_start: false,
  e4b_classify_complete: true,
  retrieval_start: false,
  retrieval_complete: true,
  objects_loaded: true,
  simulation_assembling: true,
  expression_start: false,
  expression_complete: true,
};

function stageFields(event: StageEvent): Record<string, JsonValue> {
  const { name: _name, ...rest } = event;
  // StageEvent's non-name fields are always plain JSON (numbers, strings,
  // booleans, and arrays/records thereof); the cast documents that fact
  // rather than fighting TS's structural check on a spread-derived type.
  return rest as unknown as Record<string, JsonValue>;
}

export function appendUserMessage(messages: readonly WorkMessage[], text: string): WorkMessage[] {
  const message: WorkMessage = {
    id: nextWorkMessageId('user'),
    role: 'user',
    text,
    toolParts: [],
    createdAt: Date.now(),
    isStreaming: false,
  };
  return [...messages, message];
}

export function appendAssistantPlaceholder(
  messages: readonly WorkMessage[],
  id: string,
): WorkMessage[] {
  const message: WorkMessage = {
    id,
    role: 'assistant',
    text: '',
    toolParts: [],
    createdAt: Date.now(),
    isStreaming: true,
  };
  return [...messages, message];
}

function updateMessage(
  messages: readonly WorkMessage[],
  id: string,
  updater: (message: WorkMessage) => WorkMessage,
): WorkMessage[] {
  return messages.map((message) => (message.id === id ? updater(message) : message));
}

export function applyStageEvent(
  messages: readonly WorkMessage[],
  assistantId: string,
  event: StageEvent,
): WorkMessage[] {
  const toolName = STAGE_TOOL_NAME[event.name];
  const terminal = STAGE_IS_TERMINAL[event.name];
  const toolCallId = `${assistantId}:${toolName}`;
  const fields = stageFields(event);

  return updateMessage(messages, assistantId, (message) => {
    const existingIndex = message.toolParts.findIndex((part) => part.toolCallId === toolCallId);
    const nextPart: WorkToolPart = existingIndex >= 0
      ? {
          ...message.toolParts[existingIndex],
          status: terminal ? 'complete' : 'running',
          result: terminal ? fields : message.toolParts[existingIndex].result,
        }
      : {
          toolCallId,
          toolName,
          args: terminal ? {} : fields,
          result: terminal ? fields : undefined,
          status: terminal ? 'complete' : 'running',
        };

    const toolParts = existingIndex >= 0
      ? message.toolParts.map((part, i) => (i === existingIndex ? nextPart : part))
      : [...message.toolParts, nextPart];

    return { ...message, toolParts };
  });
}

export function applyToken(
  messages: readonly WorkMessage[],
  assistantId: string,
  token: string,
): WorkMessage[] {
  return updateMessage(messages, assistantId, (message) => ({
    ...message,
    text: message.text + token,
  }));
}

/** Mirrors useChatHistory's narrative-first, streamed-token-fallback text resolution. */
function resolveFinalText(result: TheseusResponse, streamedText: string): string {
  const narrative = result.sections.find(
    (section): section is typeof section & { content: string } =>
      section.type === 'narrative' && 'content' in section,
  );
  return narrative?.content || result.answer || streamedText;
}

export function applyComplete(
  messages: readonly WorkMessage[],
  assistantId: string,
  result: TheseusResponse,
): WorkMessage[] {
  return updateMessage(messages, assistantId, (message) => ({
    ...message,
    text: resolveFinalText(result, message.text),
    isStreaming: false,
  }));
}

export function applyError(
  messages: readonly WorkMessage[],
  assistantId: string,
  error: string,
): WorkMessage[] {
  return updateMessage(messages, assistantId, (message) => ({
    ...message,
    isStreaming: false,
    error,
  }));
}

/**
 * WS3 one-shot tool calls (/recall, /ping). Unlike the Theseus stage
 * machinery above, these never stream tokens: a single tool part goes
 * straight from 'running' to 'complete' once the real backend call
 * (gqlAsk or the Tauri room_context command) settles.
 */
export function beginToolCall(
  messages: readonly WorkMessage[],
  assistantId: string,
  toolCallId: string,
  toolName: string,
  args: Readonly<Record<string, JsonValue>>,
): WorkMessage[] {
  return updateMessage(messages, assistantId, (message) => ({
    ...message,
    toolParts: [...message.toolParts, { toolCallId, toolName, args, status: 'running' }],
  }));
}

export function completeToolCall(
  messages: readonly WorkMessage[],
  assistantId: string,
  toolCallId: string,
  result: JsonValue,
): WorkMessage[] {
  return updateMessage(messages, assistantId, (message) => ({
    ...message,
    isStreaming: false,
    toolParts: message.toolParts.map((part) =>
      part.toolCallId === toolCallId ? { ...part, status: 'complete', result } : part,
    ),
  }));
}

/** Failure is still a "complete" tool part (result carries the error) so the tool view can render it. */
export function failToolCall(
  messages: readonly WorkMessage[],
  assistantId: string,
  toolCallId: string,
  error: string,
): WorkMessage[] {
  return updateMessage(messages, assistantId, (message) => ({
    ...message,
    isStreaming: false,
    error,
    toolParts: message.toolParts.map((part) =>
      part.toolCallId === toolCallId ? { ...part, status: 'complete', result: { error } } : part,
    ),
  }));
}

/** Convert a persisted WorkMessage into assistant-ui's ThreadMessageLike shape. */
export function toThreadMessageLike(message: WorkMessage): ThreadMessageLike {
  if (message.role === 'user') {
    return {
      role: 'user',
      id: message.id,
      content: [{ type: 'text', text: message.text }],
      createdAt: new Date(message.createdAt),
    };
  }

  const toolParts = message.toolParts.map((part) => ({
    type: 'tool-call' as const,
    toolCallId: part.toolCallId,
    toolName: part.toolName,
    args: part.args,
    result: part.result,
  }));
  const textParts = message.text ? [{ type: 'text' as const, text: message.text }] : [];

  return {
    role: 'assistant',
    id: message.id,
    content: [...toolParts, ...textParts],
    createdAt: new Date(message.createdAt),
    status: message.error
      ? { type: 'incomplete', reason: 'error' }
      : message.isStreaming
        ? { type: 'running' }
        : { type: 'complete', reason: 'stop' },
    metadata: { custom: { error: message.error ?? '' } },
  };
}

/** Build AsyncStreamHandlers that apply pure transitions through a setter. */
export function createStreamHandlers(
  assistantId: string,
  setMessages: (updater: (messages: readonly WorkMessage[]) => WorkMessage[]) => void,
  onSettled: () => void,
): AsyncStreamHandlers {
  return {
    onStage(event) {
      setMessages((messages) => applyStageEvent(messages, assistantId, event));
    },
    onToken(token) {
      setMessages((messages) => applyToken(messages, assistantId, token));
    },
    onComplete(result) {
      setMessages((messages) => applyComplete(messages, assistantId, result));
      onSettled();
    },
    onError(error) {
      setMessages((messages) => applyError(messages, assistantId, error.message));
      onSettled();
    },
  };
}
