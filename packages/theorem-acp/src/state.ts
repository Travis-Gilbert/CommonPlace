export type AgentProcessKey = {
  mount: string;
  mode: 'single' | 'composed';
  bindingId: string | null;
};

export type HeadContribution = {
  headId: string;
  summary: string;
  at: number;
};

export type BridgeToolCall = {
  callId: string;
  name: string;
  rawInput: unknown;
  status: 'pending' | 'completed';
  rawOutput?: unknown;
};

export type PendingPermission = {
  callId: string;
  name: string;
  rawInput: unknown;
};

export type TheoremAgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  contributions: HeadContribution[];
  toolCalls: BridgeToolCall[];
};

export type TheoremAgentState = {
  sessionId: string | null;
  mode: 'single' | 'composed';
  bindingId: string | null;
  turnStatus: 'idle' | 'running' | 'complete' | 'refused' | 'failed';
  messages: TheoremAgentMessage[];
  pendingPermission: PendingPermission | null;
  blockedReason: string | null;
};

export type AcpSessionUpdate = {
  sessionUpdate: string;
  content?: {
    type?: string;
    text?: string;
    content?: { type?: string; text?: string };
  };
  toolCallId?: string;
  title?: string;
  rawInput?: unknown;
  rawOutput?: unknown;
  status?: string;
};

const thoughtPrefix = /^\[([^\]]+)\]\s*([\s\S]*)$/;

export function createTheoremAgentState(
  key: Pick<AgentProcessKey, 'mode' | 'bindingId'>,
  sessionId: string | null = null,
): TheoremAgentState {
  return {
    sessionId,
    mode: key.mode,
    bindingId: key.bindingId,
    turnStatus: 'idle',
    messages: [],
    pendingPermission: null,
    blockedReason: null,
  };
}

export function beginTurn(state: TheoremAgentState, text: string): TheoremAgentState {
  return {
    ...state,
    turnStatus: 'running',
    blockedReason: null,
    pendingPermission: null,
    messages: [
      ...state.messages,
      createMessage('user', text),
      createMessage('assistant', ''),
    ],
  };
}

export function applySessionUpdate(
  state: TheoremAgentState,
  update: AcpSessionUpdate,
): TheoremAgentState {
  switch (update.sessionUpdate) {
    case 'agent_thought_chunk':
      return appendContribution(state, readText(update));
    case 'agent_message_chunk':
      return appendAssistantText(state, readText(update));
    case 'tool_call':
      if (!update.toolCallId) return state;
      return addToolCall(state, {
        callId: update.toolCallId,
        name: update.title ?? 'tool',
        rawInput: update.rawInput ?? null,
        status: 'pending',
      });
    case 'tool_call_update':
      return updateToolCall(state, update);
    default:
      return state;
  }
}

export function completeTurn(
  state: TheoremAgentState,
  stopReason: string | undefined,
): TheoremAgentState {
  return {
    ...state,
    turnStatus: state.turnStatus === 'refused' || stopReason === 'refusal' ? 'refused' : 'complete',
    pendingPermission: null,
  };
}

export function failTurn(state: TheoremAgentState): TheoremAgentState {
  return { ...state, turnStatus: 'failed', pendingPermission: null };
}

export function setPendingPermission(
  state: TheoremAgentState,
  permission: PendingPermission,
): TheoremAgentState {
  const withTool = addToolCall(state, {
    callId: permission.callId,
    name: permission.name,
    rawInput: permission.rawInput,
    status: 'pending',
  });
  return { ...withTool, pendingPermission: permission, turnStatus: 'running' };
}

export function resolvePendingPermission(
  state: TheoremAgentState,
  callId: string,
  decision: 'allow' | 'reject',
): TheoremAgentState {
  if (state.pendingPermission?.callId !== callId) return state;
  return updateToolCall(
    { ...state, pendingPermission: null, turnStatus: 'running' },
    {
      sessionUpdate: 'tool_call_update',
      toolCallId: callId,
      status: 'completed',
      rawOutput: decision === 'allow' ? 'approved by user' : 'rejected by user',
    },
  );
}

function appendContribution(state: TheoremAgentState, text: string): TheoremAgentState {
  const match = text.match(thoughtPrefix);
  const contribution: HeadContribution = match
    ? { headId: match[1]!, summary: match[2]!, at: Date.now() }
    : { headId: 'unattributed', summary: text, at: Date.now() };
  return updateCurrentAssistant(state, (message) => ({
    ...message,
    contributions: [...message.contributions, contribution],
  }));
}

function appendAssistantText(state: TheoremAgentState, text: string): TheoremAgentState {
  const blockedPrefix = 'composed run blocked:';
  if (text.startsWith(blockedPrefix)) {
    return {
      ...state,
      blockedReason: text.slice(blockedPrefix.length).trim(),
      turnStatus: 'refused',
    };
  }
  return updateCurrentAssistant(state, (message) => ({ ...message, text: `${message.text}${text}` }));
}

function addToolCall(state: TheoremAgentState, toolCall: BridgeToolCall): TheoremAgentState {
  return updateCurrentAssistant(state, (message) => {
    if (message.toolCalls.some((existing) => existing.callId === toolCall.callId)) return message;
    return { ...message, toolCalls: [...message.toolCalls, toolCall] };
  });
}

function updateToolCall(state: TheoremAgentState, update: AcpSessionUpdate): TheoremAgentState {
  const callId = update.toolCallId;
  if (!callId) return state;
  return updateCurrentAssistant(state, (message) => ({
    ...message,
    toolCalls: message.toolCalls.map((toolCall) =>
      toolCall.callId !== callId
        ? toolCall
        : {
            ...toolCall,
            name: update.title ?? toolCall.name,
            rawInput: update.rawInput ?? toolCall.rawInput,
            status: update.status === 'completed' ? 'completed' : toolCall.status,
            ...(update.rawOutput === undefined ? {} : { rawOutput: update.rawOutput }),
          },
    ),
  }));
}

function updateCurrentAssistant(
  state: TheoremAgentState,
  update: (message: TheoremAgentMessage) => TheoremAgentMessage,
): TheoremAgentState {
  const index = state.messages.map((message) => message.role).lastIndexOf('assistant');
  if (index < 0) return { ...state, messages: [...state.messages, update(createMessage('assistant', ''))] };
  return {
    ...state,
    messages: state.messages.map((message, messageIndex) => (messageIndex === index ? update(message) : message)),
  };
}

function createMessage(role: 'user' | 'assistant', text: string): TheoremAgentMessage {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    text,
    contributions: [],
    toolCalls: [],
  };
}

function readText(update: AcpSessionUpdate): string {
  const content = update.content as
    | { type?: string; text?: string; content?: { type?: string; text?: string } }
    | undefined;
  if (!content) return '';
  // Canonical ACP ContentBlock: { type: "text", text }
  if (content.type === 'text' && typeof content.text === 'string') return content.text;
  // Legacy double-nested shape some projectors accepted
  if (content.content?.type === 'text' && typeof content.content.text === 'string') {
    return content.content.text;
  }
  return '';
}
