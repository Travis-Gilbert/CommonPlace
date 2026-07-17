import { AcpClient, type AcpSessionNotification, type RequestPermissionRequest } from './client';
import {
  HostedAcpClient,
  hostedAgentIdForKey,
  resolveAcpTransport,
} from './hosted-client';
import {
  applySessionUpdate,
  beginTurn,
  completeTurn,
  createTheoremAgentState,
  failTurn,
  resolvePendingPermission,
  setPendingPermission,
  type AgentProcessKey,
  type PendingPermission,
  type TheoremAgentState,
} from './state';

export type AcquiredAcpSession = {
  client: AcpTransport;
  sessionId: string;
  getState(): TheoremAgentState;
  subscribe(listener: (state: TheoremAgentState) => void): () => void;
  prompt(text: string, options?: { displayText?: string }): Promise<void>;
  respondPermission(callId: string, decision: 'allow' | 'reject'): boolean;
  cancel(): Promise<void>;
};

type AcpTransport = AcpClient | HostedAcpClient;

type ProcessEntry = {
  client: AcpTransport;
  sessions: Map<string, ManagedAcpSession>;
};

type PendingDecision = {
  resolve: (decision: 'allow' | 'reject') => void;
  timeout: ReturnType<typeof setTimeout>;
};

class ManagedAcpSession implements AcquiredAcpSession {
  #state: TheoremAgentState;
  #listeners = new Set<(state: TheoremAgentState) => void>();
  #permissions = new Map<string, PendingDecision>();

  constructor(
    readonly client: AcpTransport,
    readonly sessionId: string,
    readonly key: AgentProcessKey,
  ) {
    this.#state = createTheoremAgentState(key, sessionId);
  }

  getState(): TheoremAgentState {
    return this.#state;
  }

  subscribe(listener: (state: TheoremAgentState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async prompt(text: string, options?: { displayText?: string }): Promise<void> {
    this.#setState(beginTurn(this.#state, options?.displayText ?? text));
    try {
      const response = await this.client.prompt(this.sessionId, text);
      this.#setState(completeTurn(this.#state, response.stopReason));
    } catch {
      this.#setState(failTurn(this.#state));
    }
  }

  async cancel(): Promise<void> {
    await this.client.cancel(this.sessionId);
  }

  onUpdate(notification: AcpSessionNotification): void {
    this.#setState(applySessionUpdate(this.#state, notification.update));
  }

  requestPermission(request: RequestPermissionRequest): Promise<'allow' | 'reject'> {
    const callId = request.toolCall.toolCallId;
    const permission: PendingPermission = {
      callId,
      name: request.toolCall.title ?? 'tool',
      rawInput: request.toolCall.rawInput ?? null,
    };
    this.#setState(setPendingPermission(this.#state, permission));
    return new Promise<'allow' | 'reject'>((resolve) => {
      const timeout = setTimeout(() => {
        this.#permissions.delete(callId);
        this.#setState(resolvePendingPermission(this.#state, callId, 'reject'));
        resolve('reject');
      }, permissionTimeoutMs());
      this.#permissions.set(callId, { resolve, timeout });
    });
  }

  respondPermission(callId: string, decision: 'allow' | 'reject'): boolean {
    const pending = this.#permissions.get(callId);
    if (!pending) return false;
    this.#permissions.delete(callId);
    clearTimeout(pending.timeout);
    this.#setState(resolvePendingPermission(this.#state, callId, decision));
    pending.resolve(decision);
    return true;
  }

  fail(): void {
    for (const pending of this.#permissions.values()) {
      clearTimeout(pending.timeout);
      pending.resolve('reject');
    }
    this.#permissions.clear();
    this.#setState(failTurn(this.#state));
  }

  #setState(state: TheoremAgentState): void {
    this.#state = state;
    for (const listener of this.#listeners) listener(state);
  }
}

export class AcpSessionManager {
  #processes = new Map<string, Promise<ProcessEntry>>();

  async acquire(key: AgentProcessKey): Promise<AcquiredAcpSession> {
    const processKey = serializeKey(key);
    let process = this.#processes.get(processKey);
    if (!process) {
      process = this.#spawnProcess(processKey, key);
      this.#processes.set(processKey, process);
    }
    const entry = await process;
    let sessionId: string;
    try {
      sessionId = await entry.client.newSession();
    } catch (error) {
      if (entry.sessions.size === 0 && this.#processes.get(processKey) === process) {
        this.#processes.delete(processKey);
        await entry.client.dispose();
      }
      throw error;
    }
    const session = new ManagedAcpSession(entry.client, sessionId, key);
    entry.sessions.set(sessionId, session);
    return session;
  }

  async get(key: AgentProcessKey, sessionId: string): Promise<AcquiredAcpSession | null> {
    const entry = await this.#processes.get(serializeKey(key));
    return entry?.sessions.get(sessionId) ?? null;
  }

  async release(sessionId: string): Promise<void> {
    for (const [processKey, process] of this.#processes) {
      const entry = await process;
      if (!entry.sessions.delete(sessionId)) continue;
      if (entry.sessions.size === 0) {
        await entry.client.dispose();
        this.#processes.delete(processKey);
      }
      return;
    }
  }

  async disposeAll(): Promise<void> {
    const results = await Promise.allSettled(this.#processes.values());
    this.#processes.clear();
    await Promise.allSettled(
      results
        .filter((result): result is PromiseFulfilledResult<ProcessEntry> => result.status === 'fulfilled')
        .map((result) => result.value.client.dispose()),
    );
  }

  async #spawnProcess(processKey: string, key: AgentProcessKey): Promise<ProcessEntry> {
    let client: AcpTransport | undefined;
    try {
      if (resolveAcpTransport() === 'hosted') {
        client = await HostedAcpClient.connect({
          agentId: hostedAgentIdForKey(key.mode, key.bindingId),
          cwd: key.mount,
          bindingId: key.bindingId,
        });
      } else {
        client = await AcpClient.spawn({
          bin: process.env.THEOREM_ACP_BIN ?? 'theorem',
          args: (process.env.THEOREM_ACP_ARGS ?? 'acp').split(/\s+/).filter(Boolean),
          cwd: key.mount,
          env: {
            THEOREM_MODEL_BACKEND_KIND: key.mode,
            ...(key.bindingId ? { THEOREM_COMPOSED_AGENT_BINDING_ID: key.bindingId } : {}),
          },
        });
      }
      await client.initialize(1);
      const entry: ProcessEntry = { client, sessions: new Map() };
      client.onSessionUpdate((notification) => entry.sessions.get(notification.sessionId)?.onUpdate(notification));
      client.onRequestPermission((request) => {
        const session = entry.sessions.get(request.sessionId);
        return session ? session.requestPermission(request) : Promise.reject(new Error('ACP session is unavailable'));
      });
      client.onExit(() => {
        for (const session of entry.sessions.values()) session.fail();
        this.#processes.delete(processKey);
      });
      return entry;
    } catch (error) {
      await client?.dispose();
      this.#processes.delete(processKey);
      throw error;
    }
  }
}

function serializeKey(key: AgentProcessKey): string {
  return JSON.stringify(key);
}

function permissionTimeoutMs(): number {
  const configured = Number(process.env.THEOREM_ACP_PERMISSION_TIMEOUT_MS ?? 300_000);
  return Number.isFinite(configured) && configured > 0 ? configured : 300_000;
}
