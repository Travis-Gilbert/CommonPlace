import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

import type { AcpSessionUpdate } from './state';

export type AcpClientOptions = {
  bin: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
};

export type InitializeResponse = {
  protocolVersion: number;
  agentCapabilities: Record<string, unknown>;
};

export type PromptResponse = {
  stopReason?: string;
};

export type AcpSessionNotification = {
  sessionId: string;
  update: AcpSessionUpdate;
};

export type RequestPermissionRequest = {
  sessionId: string;
  toolCall: {
    toolCallId: string;
    title?: string;
    rawInput?: unknown;
  };
  options: Array<{ optionId: string; kind?: string }>;
};

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown;
};

type JsonRpcResponse = {
  id: number | string;
  result?: unknown;
  error?: { code?: number; message?: string };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class AcpClient {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #cwd: string;
  #nextId = 1;
  #disposed = false;
  #exitError: Error | undefined;
  #pending = new Map<string, PendingRequest>();
  #sessionHandlers = new Set<(notification: AcpSessionNotification) => void>();
  #permissionHandler:
    | ((request: RequestPermissionRequest) => Promise<'allow' | 'reject'>)
    | undefined;
  #exitHandlers = new Set<(error: Error) => void>();

  private constructor(child: ChildProcessWithoutNullStreams, cwd: string) {
    this.#child = child;
    this.#cwd = cwd;
    this.#wire();
  }

  get pid(): number | undefined {
    return this.#child.pid;
  }

  static async spawn(options: AcpClientOptions): Promise<AcpClient> {
    const child = spawn(options.bin, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: 'pipe',
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    return new AcpClient(child, options.cwd);
  }

  initialize(protocolVersion: number): Promise<InitializeResponse> {
    return this.#request('initialize', {
      protocolVersion,
      clientCapabilities: {},
      clientInfo: { name: 'commonplace', version: '1.0.0' },
    }) as Promise<InitializeResponse>;
  }

  async newSession(): Promise<string> {
    const response = (await this.#request('session/new', {
      cwd: this.#cwd,
      mcpServers: [],
    })) as { sessionId: string };
    return response.sessionId;
  }

  prompt(sessionId: string, text: string): Promise<PromptResponse> {
    return this.#request('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text }],
    }) as Promise<PromptResponse>;
  }

  async cancel(sessionId: string): Promise<void> {
    this.#notify('session/cancel', { sessionId });
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
    this.#rejectPending(new Error('ACP client was disposed'));
    if (this.#child.exitCode !== null || this.#child.signalCode !== null) return;
    const exited = new Promise<void>((resolve) => this.#child.once('close', () => resolve()));
    try {
      this.#child.kill('SIGTERM');
    } catch {
      return;
    }
    const timeout = setTimeout(() => this.#child.kill('SIGKILL'), 2_000);
    await exited;
    clearTimeout(timeout);
  }

  #wire(): void {
    createInterface({ input: this.#child.stdout }).on('line', (line) => this.#onLine(line));
    this.#child.stderr.on('data', (chunk: Buffer) => {
      process.stderr.write(`[theorem acp] ${chunk.toString()}`);
    });
    this.#child.stdin.on('error', (error) => this.#onExit(error));
    this.#child.on('error', (error) => this.#onExit(error));
    this.#child.on('close', (code, signal) => {
      if (!this.#disposed) this.#onExit(new Error(`theorem acp exited (${code ?? signal ?? 'unknown'})`));
    });
  }

  #onLine(line: string): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      process.stderr.write('[theorem acp] ignored invalid JSON-RPC stdout line\n');
      return;
    }
    if (typeof message.method === 'string') {
      this.#onIncomingMethod(message);
      return;
    }
    if (typeof message.id === 'number' || typeof message.id === 'string') {
      const pending = this.#pending.get(String(message.id));
      if (!pending) return;
      this.#pending.delete(String(message.id));
      const response = message as JsonRpcResponse;
      if (response.error) {
        pending.reject(new Error(response.error.message ?? 'ACP request failed'));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  #onIncomingMethod(message: Record<string, unknown>): void {
    if (message.method === 'session/update') {
      const params = message.params as AcpSessionNotification;
      for (const handler of this.#sessionHandlers) handler(params);
      return;
    }
    if (message.method === 'session/request_permission' && (typeof message.id === 'number' || typeof message.id === 'string')) {
      void this.#respondPermission(message.id, message.params as RequestPermissionRequest);
    }
  }

  async #respondPermission(id: number | string, request: RequestPermissionRequest): Promise<void> {
    if (!this.#permissionHandler) {
      this.#sendPermissionError(id, 'CommonPlace permission handler is unavailable');
      return;
    }
    try {
      const decision = await this.#permissionHandler(request);
      const selected = request.options.find((option) => option.kind?.startsWith(decision));
      if (!selected) throw new Error(`ACP permission request has no ${decision} option`);
      this.#write({
        jsonrpc: '2.0',
        id,
        result: { outcome: { outcome: 'selected', optionId: selected.optionId } },
      });
    } catch (error) {
      this.#sendPermissionError(id, error instanceof Error ? error.message : String(error));
    }
  }

  #request(method: string, params: unknown): Promise<unknown> {
    if (this.#disposed) return Promise.reject(new Error('ACP client is disposed'));
    const id = this.#nextId++;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise<unknown>((resolve, reject) => {
      this.#pending.set(String(id), { resolve, reject });
      try {
        this.#write(request);
      } catch (error) {
        this.#pending.delete(String(id));
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  #notify(method: string, params: unknown): void {
    this.#write({ jsonrpc: '2.0', method, params });
  }

  #write(message: Record<string, unknown>): void {
    if (this.#disposed || this.#child.stdin.destroyed || !this.#child.stdin.writable) {
      throw new Error('ACP client is not writable');
    }
    this.#child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #sendPermissionError(id: number | string, message: string): void {
    try {
      this.#write({ jsonrpc: '2.0', id, error: { code: -32000, message } });
    } catch {
      // The peer exited before it could receive the response.
    }
  }

  #onExit(error: Error): void {
    if (this.#exitError) return;
    this.#exitError = error;
    this.#disposed = true;
    this.#rejectPending(error);
    for (const handler of this.#exitHandlers) handler(error);
  }

  #rejectPending(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}
