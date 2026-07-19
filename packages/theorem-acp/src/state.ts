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

export const TURN_CONTEXT_SCHEMA = 'turn-context/1' as const;

export type TurnRoute = 'chat' | 'research' | 'agent';

export type TurnContext = {
  schema_version: typeof TURN_CONTEXT_SCHEMA;
  route: TurnRoute;
  published_acknowledgement?: string | null;
  context_anchors: string[];
  required_capabilities: string[];
};

export type TurnActivityStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type TheoremAgentMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  acknowledgement: string | null;
  contributions: HeadContribution[];
  toolCalls: BridgeToolCall[];
};

export type TheoremAgentState = {
  sessionId: string | null;
  mode: 'single' | 'composed';
  bindingId: string | null;
  turnStatus: 'idle' | 'running' | 'complete' | 'refused' | 'failed' | 'cancelled';
  activityStatus: TurnActivityStatus | null;
  messages: TheoremAgentMessage[];
  pendingPermission: PendingPermission | null;
  blockedReason: string | null;
  error: string | null;
  appliedUpdateKeys: string[];
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
  eventId?: string;
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
    activityStatus: null,
    messages: [],
    pendingPermission: null,
    blockedReason: null,
    error: null,
    appliedUpdateKeys: [],
  };
}

export function beginTurn(
  state: TheoremAgentState,
  text: string,
  turnContext?: TurnContext,
): TheoremAgentState {
  const acknowledgement = turnContext?.published_acknowledgement?.trim() || null;
  return {
    ...state,
    turnStatus: 'running',
    activityStatus: null,
    blockedReason: null,
    error: null,
    pendingPermission: null,
    appliedUpdateKeys: [],
    messages: [
      ...state.messages,
      createMessage('user', text),
      { ...createMessage('assistant', ''), acknowledgement },
    ],
  };
}

export function applySessionUpdate(
  state: TheoremAgentState,
  update: AcpSessionUpdate,
): TheoremAgentState {
  if (isSettled(state.turnStatus)) return state;
  const updateKey = sessionUpdateKey(update);
  if (updateKey && state.appliedUpdateKeys.includes(updateKey)) return state;
  const withUpdateKey = updateKey
    ? {
        ...state,
        appliedUpdateKeys: [...state.appliedUpdateKeys.slice(-255), updateKey],
      }
    : state;
  switch (update.sessionUpdate) {
    case 'theorem_turn_activity':
      return applyActivityStatus(withUpdateKey, update.status);
    case 'agent_thought_chunk':
      return appendContribution(withUpdateKey, readText(update));
    case 'agent_message_chunk':
      return appendAssistantText(withUpdateKey, readText(update));
    case 'tool_call':
      if (!update.toolCallId) return withUpdateKey;
      return addToolCall(withUpdateKey, {
        callId: update.toolCallId,
        name: update.title ?? 'tool',
        rawInput: update.rawInput ?? null,
        status: 'pending',
      });
    case 'tool_call_update':
      return updateToolCall(withUpdateKey, update);
    default:
      return state;
  }
}

export function completeTurn(
  state: TheoremAgentState,
  stopReason: string | undefined,
): TheoremAgentState {
  if (isSettled(state.turnStatus)) return state;
  if (stopReason === 'cancelled') return cancelTurn(state);
  if (stopReason === 'error') return failTurn(state, state.error);
  return {
    ...state,
    turnStatus: state.turnStatus === 'refused' || stopReason === 'refusal' ? 'refused' : 'complete',
    activityStatus: 'completed',
    pendingPermission: null,
  };
}

export function failTurn(
  state: TheoremAgentState,
  error: string | null = null,
): TheoremAgentState {
  if (isSettled(state.turnStatus)) return state;
  return {
    ...state,
    turnStatus: 'failed',
    activityStatus: 'failed',
    pendingPermission: null,
    error,
  };
}

export function cancelTurn(state: TheoremAgentState): TheoremAgentState {
  if (isSettled(state.turnStatus)) return state;
  return {
    ...state,
    turnStatus: 'cancelled',
    activityStatus: 'cancelled',
    pendingPermission: null,
  };
}

export function setPendingPermission(
  state: TheoremAgentState,
  permission: PendingPermission,
): TheoremAgentState {
  if (isSettled(state.turnStatus)) return state;
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
  if (isSettled(state.turnStatus)) return state;
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
    acknowledgement: null,
    contributions: [],
    toolCalls: [],
  };
}

export function isTurnContext(value: unknown): value is TurnContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const context = value as Partial<TurnContext>;
  return (
    context.schema_version === TURN_CONTEXT_SCHEMA &&
    (context.route === 'chat' || context.route === 'research' || context.route === 'agent') &&
    (context.published_acknowledgement === undefined ||
      context.published_acknowledgement === null ||
      (typeof context.published_acknowledgement === 'string' &&
        context.published_acknowledgement.trim().length > 0 &&
        context.published_acknowledgement.length <= 320)) &&
    Array.isArray(context.context_anchors) &&
    context.context_anchors.length <= 8 &&
    context.context_anchors.every(
      (anchor) =>
        typeof anchor === 'string' &&
        anchor.trim().length > 0 &&
        anchor.length <= 160,
    ) &&
    Array.isArray(context.required_capabilities) &&
    context.required_capabilities.length <= 8 &&
    context.required_capabilities.every(
      (capability) =>
        typeof capability === 'string' &&
        capability.trim().length > 0 &&
        capability.length <= 80,
    )
  );
}

function applyActivityStatus(
  state: TheoremAgentState,
  status: string | undefined,
): TheoremAgentState {
  if (
    status !== 'running' &&
    status !== 'completed' &&
    status !== 'failed' &&
    status !== 'cancelled'
  ) {
    return state;
  }
  if (status === 'cancelled') return cancelTurn(state);
  return { ...state, activityStatus: status };
}

function sessionUpdateKey(update: AcpSessionUpdate): string | null {
  if (update.eventId) return `event:${update.eventId}`;
  if (update.sessionUpdate === 'theorem_turn_activity') {
    return `activity:${update.status ?? 'unknown'}`;
  }
  return null;
}

function isSettled(status: TheoremAgentState['turnStatus']): boolean {
  return status !== 'idle' && status !== 'running';
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
