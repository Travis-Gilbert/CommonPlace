// SOURCING: none, pure logic, no upstream component applies
/**
 * Hosted ACP transport: CommonPlace BFF attaches to Theorem's Railway ACP host
 * over `/v1/commonplace/acp/ws` instead of spawning a local `theorem acp`.
 *
 * Local spawn remains available when THEOREM_ACP_TRANSPORT=local (desktop /
 * opt-in local-dev).
 */

import { localInquiryUrl, forwardAuthHeaders } from './node-upstream';
import type {
  AcpSessionNotification,
  InitializeResponse,
  PromptResponse,
  RequestPermissionRequest,
} from './client';
import type { TurnContext } from './state';

export type HostedAcpClientOptions = {
  agentId: string;
  cwd: string;
  bindingId?: string | null;
  /** Optional request whose Authorization is forwarded to the hosted node. */
  authRequest?: Request;
};

type PendingPrompt = {
  sessionId: string;
  resolve: (value: PromptResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type PendingSession = {
  resolve: (sessionId: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export class HostedAcpClient {
  #socket: WebSocket;
  #agentId: string;
  #cwd: string;
  #disposed = false;
  #exitError: Error | undefined;
  #pendingSession: PendingSession | undefined;
  #pendingPrompts = new Map<string, PendingPrompt>();
  #sessionHandlers = new Set<(notification: AcpSessionNotification) => void>();
  #permissionHandler:
    | ((request: RequestPermissionRequest) => Promise<'allow' | 'reject'>)
    | undefined;
  #exitHandlers = new Set<(error: Error) => void>();

  private constructor(socket: WebSocket, agentId: string, cwd: string) {
    this.#socket = socket;
    this.#agentId = agentId;
    this.#cwd = cwd;
    this.#wire();
  }

  static async connect(options: HostedAcpClientOptions): Promise<HostedAcpClient> {
    const url = resolveHostedAcpWsUrl(options.authRequest);
    const socket = new WebSocket(url);
    await waitForOpen(socket);
    return new HostedAcpClient(socket, options.agentId, options.cwd);
  }

  initialize(_protocolVersion: number): Promise<InitializeResponse> {
    return Promise.resolve({
      protocolVersion: 1,
      agentCapabilities: { transport: 'hosted-websocket' },
    });
  }

  newSession(): Promise<string> {
    if (this.#disposed) return Promise.reject(new Error('Hosted ACP client was disposed'));
    if (this.#pendingSession) {
      return Promise.reject(new Error('Hosted ACP start_session is already in flight'));
    }
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pendingSession = undefined;
        reject(new Error('Hosted ACP start_session timed out'));
      }, sessionStartTimeoutMs());
      this.#pendingSession = { resolve, reject, timeout };
      try {
        this.#send({
          type: 'start_session',
          agent_id: this.#agentId,
          cwd: this.#cwd,
        });
      } catch (error) {
        clearTimeout(timeout);
        this.#pendingSession = undefined;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  prompt(
    sessionId: string,
    text: string,
    turnContext?: TurnContext,
  ): Promise<PromptResponse> {
    if (this.#disposed) return Promise.reject(new Error('Hosted ACP client was disposed'));
    if (this.#pendingPrompts.has(sessionId)) {
      return Promise.reject(new Error(`Hosted ACP prompt already in flight for ${sessionId}`));
    }
    return new Promise<PromptResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pendingPrompts.delete(sessionId);
        reject(new Error('Hosted ACP prompt timed out'));
      }, promptTimeoutMs());
      this.#pendingPrompts.set(sessionId, { sessionId, resolve, reject, timeout });
      try {
        this.#send(hostedPromptEnvelope(sessionId, text, turnContext));
      } catch (error) {
        clearTimeout(timeout);
        this.#pendingPrompts.delete(sessionId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async cancel(sessionId: string): Promise<void> {
    if (this.#disposed) return;
    const pending = this.#pendingPrompts.get(sessionId);
    if (!pending) return;
    let sendError: unknown;
    try {
      this.#send(hostedCancelEnvelope(sessionId));
    } catch (error) {
      sendError = error;
    }
    clearTimeout(pending.timeout);
    this.#pendingPrompts.delete(sessionId);
    pending.reject(new Error('Hosted ACP prompt was cancelled'));
    if (sendError) throw sendError;
  }

  onSessionUpdate(handler: (notification: AcpSessionNotification) => void): () => void {
    this.#sessionHandlers.add(handler);
    return () => this.#sessionHandlers.delete(handler);
  }

  onRequestPermission(
    handler: (request: RequestPermissionRequest) => Promise<'allow' | 'reject'>,
  ): void {
    this.#permissionHandler = handler;
  }

  onExit(handler: (error: Error) => void): () => void {
    this.#exitHandlers.add(handler);
    return () => this.#exitHandlers.delete(handler);
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#rejectPending(new Error('Hosted ACP client was disposed'));
    try {
      this.#socket.close();
    } catch {
      // ignore
    }
  }

  #wire(): void {
    this.#socket.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : String(event.data);
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      this.#onMessage(message);
    });
    this.#socket.addEventListener('close', () => {
      if (this.#disposed) return;
      this.#onExit(new Error('Hosted ACP WebSocket closed'));
    });
    this.#socket.addEventListener('error', () => {
      if (this.#disposed) return;
      this.#onExit(new Error('Hosted ACP WebSocket error'));
    });
  }

  #onMessage(message: Record<string, unknown>): void {
    const type = typeof message.type === 'string' ? message.type : '';
    if (type === 'session_started') {
      const sessionId =
        typeof message.session_id === 'string' ? message.session_id : null;
      if (sessionId && this.#pendingSession) {
        clearTimeout(this.#pendingSession.timeout);
        this.#pendingSession.resolve(sessionId);
        this.#pendingSession = undefined;
      }
      return;
    }

    if (type === 'session_update') {
      const sessionId =
        typeof message.session_id === 'string' ? message.session_id : '';
      const update = message.update;
      if (update && typeof update === 'object') {
        const record = update as Record<string, unknown>;
        if (record.method === 'session/update' && record.params) {
          const params = record.params as AcpSessionNotification;
          for (const handler of this.#sessionHandlers) handler(params);
        }
        if (record.response) {
          const pending = this.#pendingPrompts.get(sessionId);
          if (pending) {
            const response = record.response as {
              result?: { stopReason?: string };
              error?: { message?: string };
            };
            clearTimeout(pending.timeout);
            this.#pendingPrompts.delete(sessionId);
            if (response.error) {
              pending.reject(new Error(response.error.message ?? 'Hosted ACP prompt failed'));
            } else {
              pending.resolve({ stopReason: response.result?.stopReason ?? 'end_turn' });
            }
          }
        }
      }
      return;
    }

    if (type === 'command_approval' && this.#permissionHandler) {
      const approval = message.approval as
        | {
            request_id?: unknown;
            params?: RequestPermissionRequest;
            terminal_id?: string;
            command?: string;
          }
        | undefined;
      // Hosted theorem|composed path surfaces ACP session/request_permission as
      // command_approval with JSON-RPC params. Provider CLI path uses terminal cards.
      const request = approval?.params;
      if (request?.sessionId && request.toolCall?.toolCallId) {
        void this.#permissionHandler(request)
          .then((decision) => {
            if (decision === 'allow') {
              const selected =
                request.options.find((option) => option.kind?.startsWith('allow')) ??
                request.options.find((option) => option.optionId.toLowerCase().includes('allow')) ??
                request.options[0];
              if (!selected) {
                throw new Error('ACP permission request has no allow option');
              }
              this.#send({
                type: 'respond_permission',
                session_id: request.sessionId,
                request_id: approval?.request_id ?? null,
                option_id: selected.optionId,
              });
              return;
            }
            this.#send({
              type: 'cancel_permission',
              session_id: request.sessionId,
              request_id: approval?.request_id ?? null,
            });
          })
          .catch((error) => {
            try {
              this.#send({
                type: 'cancel_permission',
                session_id: request.sessionId,
                request_id: approval?.request_id ?? null,
              });
            } catch {
              // peer gone
            }
            this.#onExit(
              error instanceof Error ? error : new Error(String(error)),
            );
          });
      }
      return;
    }

    if (type === 'error') {
      const errMessage =
        typeof message.message === 'string' ? message.message : 'Hosted ACP error';
      if (this.#pendingSession) {
        clearTimeout(this.#pendingSession.timeout);
        this.#pendingSession.reject(new Error(errMessage));
        this.#pendingSession = undefined;
      }
      const sessionId =
        typeof message.session_id === 'string' ? message.session_id : null;
      if (sessionId) {
        const pending = this.#pendingPrompts.get(sessionId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.#pendingPrompts.delete(sessionId);
          pending.reject(new Error(errMessage));
        }
      } else {
        for (const [id, pending] of this.#pendingPrompts) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(errMessage));
          this.#pendingPrompts.delete(id);
        }
      }
    }
  }

  #send(payload: Record<string, unknown>): void {
    if (this.#disposed || this.#socket.readyState !== WebSocket.OPEN) {
      throw new Error('Hosted ACP WebSocket is not open');
    }
    this.#socket.send(JSON.stringify(payload));
  }

  #onExit(error: Error): void {
    if (this.#exitError) return;
    this.#exitError = error;
    this.#disposed = true;
    this.#rejectPending(error);
    for (const handler of this.#exitHandlers) handler(error);
  }

  #rejectPending(error: Error): void {
    if (this.#pendingSession) {
      clearTimeout(this.#pendingSession.timeout);
      this.#pendingSession.reject(error);
      this.#pendingSession = undefined;
    }
    for (const [id, pending] of this.#pendingPrompts) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.#pendingPrompts.delete(id);
    }
  }
}

export function resolveAcpTransport(): 'hosted' | 'local' {
  const configured = (process.env.THEOREM_ACP_TRANSPORT ?? '').trim().toLowerCase();
  if (configured === 'local' || configured === 'spawn') return 'local';
  if (configured === 'hosted' || configured === 'remote' || configured === 'ws') return 'hosted';
  // Hosted CommonPlace / Railway must attach to the remote ACP host by default.
  if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
    return 'hosted';
  }
  // Local desktop / opt-in: prefer spawn when a binary path is configured.
  if (process.env.THEOREM_ACP_BIN?.trim()) return 'local';
  return 'hosted';
}

export function hostedPromptEnvelope(
  sessionId: string,
  text: string,
  turnContext?: TurnContext,
): Record<string, unknown> {
  return {
    type: 'prompt',
    session_id: sessionId,
    text,
    ...(turnContext ? { turn_context: turnContext } : {}),
  };
}

export function hostedCancelEnvelope(sessionId: string): Record<string, unknown> {
  return { type: 'cancel_prompt', session_id: sessionId };
}

export function resolveHostedAcpWsUrl(authRequest?: Request): string {
  const configured =
    process.env.THEOREM_ACP_WS_URL?.trim() ||
    process.env.NEXT_PUBLIC_COMMONPLACE_ACP_WS_URL?.trim();
  if (configured) {
    return appendToken(configured, authRequest);
  }
  const httpBase = localInquiryUrl('').replace(/\/+$/, '');
  const wsBase = httpBase.replace(/^http/, 'ws');
  return appendToken(`${wsBase}/v1/commonplace/acp/ws`, authRequest);
}

export function hostedAgentIdForKey(mode: 'single' | 'composed', bindingId: string | null): string {
  if (mode === 'composed') return 'theorem';
  return bindingId?.replace(/^agent:/, '') || 'theorem';
}

function appendToken(url: string, authRequest?: Request): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('token') || parsed.searchParams.has('access_token')) {
      return parsed.toString();
    }
    const headers = forwardAuthHeaders(authRequest ?? new Request('http://localhost'));
    const authorization =
      typeof (headers as Record<string, string>).Authorization === 'string'
        ? (headers as Record<string, string>).Authorization
        : undefined;
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (token) parsed.searchParams.set('token', token);
    return parsed.toString();
  } catch {
    return url;
  }
}

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Failed to open hosted ACP WebSocket'));
    };
    const cleanup = () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onError);
    };
    socket.addEventListener('open', onOpen);
    socket.addEventListener('error', onError);
  });
}

function sessionStartTimeoutMs(): number {
  const configured = Number(process.env.THEOREM_ACP_SESSION_TIMEOUT_MS ?? 30_000);
  return Number.isFinite(configured) && configured > 0 ? configured : 30_000;
}

function promptTimeoutMs(): number {
  const configured = Number(process.env.THEOREM_ACP_PROMPT_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(configured) && configured > 0 ? configured : 120_000;
}
