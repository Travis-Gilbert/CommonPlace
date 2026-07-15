'use client';

import type { ReadonlyJSONValue } from 'assistant-stream/utils';
import { useMemo } from 'react';
import {
  useAssistantTransportRuntime,
  type AssistantRuntime,
  type ThreadAssistantMessage,
  type ThreadMessage,
} from '@assistant-ui/react';

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
    return {
      messages: state.messages.map((message, index) =>
        toThreadMessage(message, state.turnStatus, index === activeAssistantIndex),
      ),
      isRunning: state.turnStatus === 'running',
      state: toSerializableState(state),
    };
  };
}

function toThreadMessage(
  message: TheoremAgentState['messages'][number],
  turnStatus: TheoremAgentState['turnStatus'],
  isLatestAssistant: boolean,
): ThreadMessage {
  if (message.role === 'user') {
    return {
      id: message.id,
      createdAt: new Date(message.createdAt),
      role: 'user',
      content: [{ type: 'text', text: message.text }],
      attachments: [],
      metadata: { custom: {} },
    };
  }
  const toolParts = message.toolCalls.map((toolCall) => ({
    type: 'tool-call' as const,
    toolCallId: toolCall.callId,
    toolName: toolCall.name,
    args: asRecord(toolCall.rawInput),
    argsText: JSON.stringify(asRecord(toolCall.rawInput)),
    ...(toolCall.rawOutput === undefined ? {} : { result: toolCall.rawOutput }),
  }));
  const textParts = message.text ? [{ type: 'text' as const, text: message.text }] : [];
  const status = messageStatus(isLatestAssistant ? turnStatus : 'complete');
  return {
    id: message.id,
    createdAt: new Date(message.createdAt),
    role: 'assistant',
    content: [...toolParts, ...textParts] as ThreadAssistantMessage['content'],
    status:
      status === 'running'
        ? { type: 'running' }
        : status === 'complete'
          ? { type: 'complete', reason: 'stop' }
          : { type: 'incomplete', reason: 'error' },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
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

function toSerializableState(state: TheoremAgentState) {
  return structuredClone(state) as ReadonlyJSONValue;
}
