// SOURCING: WebSocket browser API. The wire protocol is CommonPlace-owned and
// is mirrored by apps/browser-native/src/loopback.rs.

import type {
  HostLens,
  HostPresence,
  WorkspaceEvent,
  WorkspaceId,
} from "../types";

export const GPUI_BRIDGE_VERSION = 1 as const;

export type GpuiHostMethod =
  | "queryObjects"
  | "invokeCapability"
  | "subscribeWorkspace"
  | "unsubscribeWorkspace"
  | "placeBlock"
  | "persistLayout"
  | "openTarget"
  | "publishPresence"
  | "publishLens";

/** Injected by the native shell before the first page script runs. */
export interface GpuiRuntimeConfig {
  version: typeof GPUI_BRIDGE_VERSION;
  endpoint: string;
  token: string;
}

/** Transport boundary used by GpuiHostAdapter and its conformance tests. */
export interface GpuiHostTransport {
  request<T>(method: GpuiHostMethod, params: unknown): Promise<T>;
  subscribeWorkspace(
    workspaceId: WorkspaceId,
    listener: (event: WorkspaceEvent) => void,
  ): () => void;
  publishPresence(workspaceId: WorkspaceId, presence: HostPresence): void;
  publishLens(workspaceId: WorkspaceId, lens: HostLens): void;
  close(): void;
}

interface WireRequest {
  version: typeof GPUI_BRIDGE_VERSION;
  id: string;
  token: string;
  method: GpuiHostMethod;
  params: unknown;
}

interface WireResponse {
  version: typeof GPUI_BRIDGE_VERSION;
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}

interface WireWorkspaceEvent {
  version: typeof GPUI_BRIDGE_VERSION;
  event: "workspace";
  subscriptionId: string;
  workspaceId: WorkspaceId;
  payload: WorkspaceEvent;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

function validateEndpoint(endpoint: string): string {
  const parsed = new URL(endpoint);
  const loopback =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
  if (parsed.protocol !== "ws:" || !loopback) {
    throw new Error("GPUI host endpoint must be an unencrypted loopback WebSocket");
  }
  return parsed.toString();
}

/**
 * Browser-side half of the authenticated native loopback channel.
 *
 * The token is carried only in WebSocket messages. It is not placed in the
 * console URL, WebSocket URL, referrer, or logs.
 */
export class WebSocketGpuiTransport implements GpuiHostTransport {
  private readonly endpoint: string;
  private socketPromise: Promise<WebSocket> | null = null;
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Map<
    string,
    (event: WorkspaceEvent) => void
  >();

  constructor(
    private readonly config: GpuiRuntimeConfig,
    private readonly socketFactory: (url: string) => WebSocket = (url) =>
      new WebSocket(url),
  ) {
    if (config.version !== GPUI_BRIDGE_VERSION) {
      throw new Error(`unsupported GPUI bridge version ${config.version}`);
    }
    if (!config.token) {
      throw new Error("GPUI host token is missing");
    }
    this.endpoint = validateEndpoint(config.endpoint);
  }

  private connect(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve(this.socket);
    }
    if (this.socketPromise) return this.socketPromise;

    this.socketPromise = new Promise<WebSocket>((resolve, reject) => {
      const socket = this.socketFactory(this.endpoint);
      let opened = false;

      socket.addEventListener("open", () => {
        opened = true;
        this.socket = socket;
        resolve(socket);
      });
      socket.addEventListener("message", (event) => this.onMessage(event.data));
      socket.addEventListener("error", () => {
        if (!opened) reject(new Error("could not connect to the GPUI host"));
      });
      socket.addEventListener("close", () => {
        this.socket = null;
        this.socketPromise = null;
        const error = new Error("GPUI host connection closed");
        for (const pending of this.pending.values()) pending.reject(error);
        this.pending.clear();
      });
    });

    return this.socketPromise;
  }

  async request<T>(method: GpuiHostMethod, params: unknown): Promise<T> {
    const id = `gpui_${this.nextId++}`;
    const socket = await this.connect();
    const request: WireRequest = {
      version: GPUI_BRIDGE_VERSION,
      id,
      token: this.config.token,
      method,
      params,
    };

    const response = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
    try {
      socket.send(JSON.stringify(request));
    } catch (error) {
      this.pending.delete(id);
      throw error;
    }
    return response;
  }

  subscribeWorkspace(
    workspaceId: WorkspaceId,
    listener: (event: WorkspaceEvent) => void,
  ): () => void {
    const subscriptionId = `subscription_${this.nextId++}`;
    this.listeners.set(subscriptionId, listener);
    void this.request<void>("subscribeWorkspace", {
      workspaceId,
      subscriptionId,
    }).catch((error: unknown) => {
      this.listeners.delete(subscriptionId);
      console.error("CommonPlace native subscription failed", error);
    });

    return () => {
      if (!this.listeners.delete(subscriptionId)) return;
      void this.request<void>("unsubscribeWorkspace", {
        subscriptionId,
      }).catch(() => undefined);
    };
  }

  publishPresence(workspaceId: WorkspaceId, presence: HostPresence): void {
    void this.request<void>("publishPresence", {
      workspaceId,
      presence,
    }).catch(() => undefined);
  }

  publishLens(workspaceId: WorkspaceId, lens: HostLens): void {
    void this.request<void>("publishLens", { workspaceId, lens }).catch(
      () => undefined,
    );
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
    this.socketPromise = null;
    const error = new Error("GPUI host transport closed");
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.listeners.clear();
  }

  private onMessage(raw: unknown): void {
    if (typeof raw !== "string") return;
    let message: WireResponse | WireWorkspaceEvent;
    try {
      message = JSON.parse(raw) as WireResponse | WireWorkspaceEvent;
    } catch {
      return;
    }
    if (message.version !== GPUI_BRIDGE_VERSION) return;

    if ("event" in message) {
      if (message.event !== "workspace") return;
      this.listeners.get(message.subscriptionId)?.(message.payload);
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(
        new Error(message.error?.message ?? "GPUI host request failed"),
      );
    }
  }
}
