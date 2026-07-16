'use client';

import { useMemo } from 'react';
import {
  useAssistantTransportRuntime,
  type AssistantRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { fromThreadMessageLike } from '@assistant-ui/core/internal';

import type { TheoremAgentState } from '@/server/acp/state';

export function useTheoremAgentRuntime(opts: {
  mode: 'single' | 'composed';
  bindingId?: string;
}): AssistantRuntime {
  const converter = useMemo(() => createConverter(), []);
  return useAssistantTransportRuntime<TheoremAgentState>({
    initialState: {
      sessionId: null,
      mode: opts.mode,
      bindingId: opts.mode === 'composed' ? opts.bindingId ?? 'agent:theorem' : null,
      turnStatus: 'idle',
      messages: [],
      pendingPermission: null,
      blockedReason: null,
    },
    api: '/api/theorem/agent/stream',
    protocol: 'assistant-transport',
    headers: { 'Content-Type': 'application/json' },
    body: {
      mode: opts.mode,
      bindingId: opts.mode === 'composed' ? opts.bindingId ?? 'agent:theorem' : null,
    },
    converter,
  });
}

function createConverter() {
  return (state: TheoremAgentState) => {
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
      state,
    };
  };
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
  const dataParts = message.contributions.map((contribution) => ({
    type: 'data-head-contribution',
    data: {
      headId: contribution.headId,
      summary: contribution.summary,
      at: contribution.at,
    },
  }));
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
    content: [...dataParts, ...toolParts, ...textParts] as unknown as ThreadMessageLike['content'],
    status:
      status === 'running'
        ? { type: 'running' }
        : status === 'complete'
          ? { type: 'complete', reason: 'stop' }
          : { type: 'incomplete', reason: 'error' },
  };
}

function lastAssistantIndex(state: TheoremAgentState): number {
  return state.messages.map((message) => message.role).lastIndexOf('assistant');
}

function messageStatus(turnStatus: TheoremAgentState['turnStatus']): 'running' | 'complete' | 'incomplete' {
  if (turnStatus === 'running') return 'running';
  if (turnStatus === 'complete' || turnStatus === 'idle') return 'complete';
  return 'incomplete';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
