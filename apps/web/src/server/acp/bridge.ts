import { AcpSessionManager, type AcquiredAcpSession } from './session-manager';
import type { AgentProcessKey, TheoremAgentState } from './state';

export type BridgeCommand =
  | {
      type: 'add-message';
      message: { role: 'user'; parts: Array<{ type: 'text'; text: string }> };
      parentId: string | null;
      sourceId: string | null;
    }
  | { type: 'permission-response'; callId: string; decision: 'allow' | 'reject' }
  | { type: 'cancel' };

export class BridgeCommandError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const globalManager = Symbol.for('commonplace.theorem-acp-session-manager');

export function getAcpSessionManager(): AcpSessionManager {
  const registry = globalThis as typeof globalThis & { [globalManager]?: AcpSessionManager };
  registry[globalManager] ??= new AcpSessionManager();
  return registry[globalManager];
}

export async function resolveBridgeSession(body: Record<string, unknown>): Promise<AcquiredAcpSession> {
  const key = resolveProcessKey(body);
  const state = body.state as Partial<TheoremAgentState> | undefined;
  if (typeof state?.sessionId === 'string') {
    const existing = await getAcpSessionManager().get(key, state.sessionId);
    if (existing) return existing;
  }
  return getAcpSessionManager().acquire(key);
}

export async function dispatchBridgeCommands(
  session: AcquiredAcpSession,
  commands: unknown,
): Promise<void> {
  for (const command of validateBridgeCommands(commands)) {
    if (command.type === 'add-message') {
      const text = command.message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n');
      void session.prompt(text);
      continue;
    }
    if (command.type === 'permission-response') {
      if (!session.respondPermission(command.callId, command.decision)) {
        throw new BridgeCommandError(`No pending permission for ${command.callId}.`, 409);
      }
      continue;
    }
    await session.cancel();
  }
}

export function validateBridgePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BridgeCommandError('Expected a JSON object.', 400);
  }
  const body = value as Record<string, unknown>;
  resolveProcessKey(body);
  validateBridgeCommands(body.commands);
  return body;
}

export function validateBridgeCommands(commands: unknown): BridgeCommand[] {
  if (!Array.isArray(commands) || commands.length === 0 || !commands.every(isCommand)) {
    throw new BridgeCommandError('Expected valid bridge commands.', 400);
  }
  return commands;
}

export function createStateStream(
  session: AcquiredAcpSession,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        signal.removeEventListener('abort', close);
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };
      if (signal.aborted) {
        controller.close();
        return;
      }
      const write = (state: TheoremAgentState) => {
        if (closed) return;
        controller.enqueue(encoder.encode(snapshotEvent(state)));
        if (state.pendingPermission || state.turnStatus !== 'running') close();
      };
      unsubscribe = session.subscribe(write);
      signal.addEventListener('abort', close, { once: true });
      write(session.getState());
    },
  });
}

export function streamHeaders(): Headers {
  return new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
}

export function resolveProcessKey(body: Record<string, unknown>): AgentProcessKey {
  const state = body.state as Partial<TheoremAgentState> | undefined;
  const mode = body.mode ?? state?.mode ?? 'composed';
  if (mode !== 'single' && mode !== 'composed') {
    throw new BridgeCommandError('mode must be single or composed.', 400);
  }
  const bindingId = body.bindingId ?? state?.bindingId ?? 'agent:theorem';
  if (bindingId !== null && typeof bindingId !== 'string') {
    throw new BridgeCommandError('bindingId must be a string or null.', 400);
  }
  return {
    mount: process.env.THEOREM_ACP_WORKSPACE_MOUNT ?? process.env.THEOREM_ACP_CWD ?? process.cwd(),
    mode,
    bindingId: mode === 'composed' ? bindingId ?? 'agent:theorem' : null,
  };
}

function snapshotEvent(state: TheoremAgentState): string {
  return `data: ${JSON.stringify({
    type: 'update-state',
    path: [],
    operations: [{ type: 'set', path: [], value: state }],
  })}\n\n`;
}

function isCommand(value: unknown): value is BridgeCommand {
  if (!value || typeof value !== 'object' || !('type' in value)) return false;
  const command = value as {
    type?: unknown;
    message?: unknown;
    callId?: unknown;
    decision?: unknown;
    parentId?: unknown;
    sourceId?: unknown;
  };
  if (command.type === 'cancel') return true;
  if (command.type === 'permission-response') {
    return typeof command.callId === 'string' && (command.decision === 'allow' || command.decision === 'reject');
  }
  if (command.type !== 'add-message' || !command.message || typeof command.message !== 'object') return false;
  const message = command.message as { role?: unknown; parts?: unknown };
  return (
    message.role === 'user' &&
    Array.isArray(message.parts) &&
    message.parts.length > 0 &&
    (command.parentId === null || typeof command.parentId === 'string') &&
    (command.sourceId === null || typeof command.sourceId === 'string') &&
    message.parts.every(
      (part) =>
        !!part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
  );
}
