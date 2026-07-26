'use client';

// SOURCING: @assistant-ui/react AssistantTransport. CH2: harness emits
// TheoremAgentState snapshots (createStateStream). No A2A v1.0 surface exists
// in theorem-acp today. LocalRuntime is excluded because it owns message state.

import { useEffect, useMemo } from 'react';
import {
  useAssistantTransportRuntime,
  type AssistantRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { fromThreadMessageLike } from '@assistant-ui/core/internal';
import type { TheoremAgentState } from '@commonplace/theorem-acp/state';
import { getDefaultStore } from 'jotai';
import {
  threadIsRunningAtom,
  threadMessagesAtom,
  threadPlanAtom,
  type AgentPlanStep,
  type ThreadMessage,
} from '@/lib/state/thread-state';

export interface ChatRuntimeOptions {
  readonly threadId: string | null;
  readonly sessionId: string | null;
  readonly capability?: { kind: 'skill' | 'plugin'; id: string; name: string } | null;
  /** Seed messages restored from the harness catalog before the first turn. */
  readonly initialMessages?: readonly ThreadMessageLike[];
}

function messageStatus(
  turnStatus: TheoremAgentState['turnStatus'],
): 'running' | 'complete' | 'incomplete' {
  if (turnStatus === 'running') return 'running';
  if (turnStatus === 'failed' || turnStatus === 'refused') return 'incomplete';
  return 'complete';
}

function toThreadMessage(
  message: TheoremAgentState['messages'][number],
  turnStatus: TheoremAgentState['turnStatus'],
  isLatestAssistant: boolean,
): ThreadMessageLike {
  if (message.role === 'user') {
    return {
      id: message.id,
      role: 'user',
      content: [{ type: 'text', text: message.text }],
    };
  }
  const toolParts = message.toolCalls.map((toolCall) => ({
    type: 'tool-call' as const,
    toolCallId: toolCall.callId,
    toolName: toolCall.name,
    args: asRecord(toolCall.rawInput),
    ...(toolCall.rawOutput === undefined ? {} : { result: toolCall.rawOutput }),
  }));
  const textParts = message.text ? [{ type: 'text' as const, text: message.text }] : [];
  const status = messageStatus(isLatestAssistant ? turnStatus : 'complete');
  return {
    id: message.id,
    role: 'assistant',
    content: [...toolParts, ...textParts] as ThreadMessageLike['content'],
    status:
      status === 'running'
        ? { type: 'running' }
        : status === 'incomplete'
          ? { type: 'incomplete', reason: 'error' }
          : { type: 'complete', reason: 'stop' },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function lastAssistantIndex(state: TheoremAgentState): number {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    if (state.messages[index]?.role === 'assistant') return index;
  }
  return -1;
}

function planFromState(state: TheoremAgentState): AgentPlanStep[] {
  const latest = [...state.messages].reverse().find((message) => message.toolCalls.length > 0);
  if (!latest) return [];
  return latest.toolCalls.map((toolCall) => ({
    id: toolCall.callId,
    label: toolCall.name,
    tool: toolCall.name,
    status: toolCall.status === 'completed' ? 'complete' : 'running',
  }));
}

function toStoreMessages(state: TheoremAgentState): ThreadMessage[] {
  return state.messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.text }],
  }));
}

function syncHarnessState(state: TheoremAgentState): void {
  const store = getDefaultStore();
  store.set(threadMessagesAtom, toStoreMessages(state));
  store.set(threadIsRunningAtom, state.turnStatus === 'running');
  store.set(threadPlanAtom, planFromState(state));
}

export function useChatPageRuntime(options: ChatRuntimeOptions): AssistantRuntime {
  const seedMessages = useMemo((): TheoremAgentState['messages'] => {
    if (!options.initialMessages?.length) return [];
    return options.initialMessages.map((message, index) => {
      const text = Array.isArray(message.content)
        ? message.content
            .map((part) => (part && typeof part === 'object' && 'text' in part ? String(part.text) : ''))
            .join('')
        : '';
      return {
        id: typeof message.id === 'string' ? message.id : `restored-${index}`,
        role: message.role === 'user' ? 'user' as const : 'assistant' as const,
        text,
        contributions: [],
        toolCalls: [],
      };
    });
  }, [options.initialMessages]);

  const converter = useMemo(
    () => (state: TheoremAgentState) => {
      syncHarnessState(state);
      const activeAssistantIndex = lastAssistantIndex(state);
      const likes = state.messages.map((message, index) =>
        toThreadMessage(message, state.turnStatus, index === activeAssistantIndex),
      );
      return {
        messages: likes.map((like, index) => {
          const fallbackStatus =
            like.role === 'assistant' && like.status
              ? like.status
              : ({ type: 'complete', reason: 'stop' } as const);
          return fromThreadMessageLike(
            like,
            state.messages[index]?.id ?? `msg-${index}`,
            fallbackStatus,
          );
        }),
        isRunning: state.turnStatus === 'running',
      };
    },
    [],
  );

  const runtime = useAssistantTransportRuntime<TheoremAgentState>({
    initialState: {
      sessionId: options.sessionId,
      mode: 'composed',
      bindingId: 'agent:theorem',
      turnStatus: 'idle',
      messages: seedMessages,
      pendingPermission: null,
      blockedReason: null,
      bootBrief: null,
    },
    api: '/api/chat/transport',
    protocol: 'assistant-transport',
    headers: { 'Content-Type': 'application/json' },
    body: {
      mode: 'composed',
      bindingId: 'agent:theorem',
      threadId: options.threadId,
      ...(options.capability
        ? {
            capability: options.capability,
          }
        : {}),
    },
    converter,
  });

  useEffect(() => {
    if (!seedMessages.length) return;
    syncHarnessState({
      sessionId: options.sessionId,
      mode: 'composed',
      bindingId: 'agent:theorem',
      turnStatus: 'idle',
      messages: seedMessages,
      pendingPermission: null,
      blockedReason: null,
      bootBrief: null,
    });
  }, [seedMessages, options.sessionId]);

  return runtime;
}
