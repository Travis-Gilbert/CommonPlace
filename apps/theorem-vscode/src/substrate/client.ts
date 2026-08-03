// SOURCING: none. Transport glue over fetch and optional EventSource.
/**
 * V1. The standing-query client for the extension host.
 *
 * SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 named choice 4: the pack speaks GraphQL
 * plus standing-query subscriptions to `commonplace-api`, generation stamps and
 * Degradation travel intact, stale generations are discarded client-side, and
 * LSP appears nowhere. Every provider in V2 through V6 consumes this one client.
 *
 * Auth: commonplace-api admits GraphQL and `/v1/editor/invalidations` through
 * `x-api-key` (Theorem PR #436 / EDITOR-DX). Bearer alone is not enough.
 *
 * Changefeed: prefer an injected EventSourceImpl (tests). In the Node
 * extension host, fall back to authenticated fetch streaming when a token is
 * present — native EventSource cannot attach headers.
 */

import type { UnavailableSurface } from '@commonplace/block-view-contracts/editor-intelligence';
import {
  EDITOR_INVALIDATIONS_PATH,
  isStaleGeneration,
  parseEditorInvalidation,
} from '@commonplace/block-view-contracts/editor-intelligence';

export interface SubstrateEndpoint {
  /** GraphQL door, e.g. https://api.example/graphql. */
  readonly graphqlUrl: string;
  /**
   * Editor invalidation SSE door. Absent disables push; subscriptions still
   * query once and the status callback says `idle` rather than a timer
   * quietly appearing.
   */
  readonly invalidationsUrl?: string;
  /** Scopes the invalidation stream to one project when the server knows it. */
  readonly projectId?: string;
  /** commonplace-api key. Sent as `x-api-key` (and Bearer for dual-door hosts). */
  readonly token?: string;
}

export type SubstrateResult<T> =
  | { readonly ok: true; readonly data: T; readonly generation: number }
  | { readonly ok: false; readonly degradation: UnavailableSurface };

export type Unsubscribe = () => void;

export type ChangefeedStatus = 'idle' | 'connecting' | 'live' | 'stale';

/** Minimum of the EventSource surface this client uses, so tests can stand one up. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface SubstrateClientOptions {
  readonly endpoint: SubstrateEndpoint;
  readonly fetchImpl?: typeof fetch;
  readonly EventSourceImpl?: new (url: string) => EventSourceLike;
  /** Where discarded responses and transport faults go. Defaults to no-op. */
  readonly log?: (message: string) => void;
  readonly onChangefeedStatus?: (status: ChangefeedStatus) => void;
}

export interface SubscribeOptions {
  /**
   * Absolute file path this query answers about. An invalidation naming a
   * different path leaves this subscription alone. Omit for workspace-wide
   * queries such as readiness, which refresh on any invalidation because
   * nothing narrower is on offer.
   */
  readonly path?: string;
}

interface Subscription<T> {
  readonly run: () => Promise<SubstrateResult<T>>;
  readonly deliver: (result: SubstrateResult<T>) => void;
  readonly path?: string;
  /** Highest generation delivered on this key. */
  seen: number;
}

/** GraphQL error entries we care about, kept narrow on purpose. */
interface GraphQlEnvelope<T> {
  data?: T | null;
  errors?: readonly { message?: string }[];
}

const NO_GENERATION = -1;

/**
 * Derive the invalidation door from the GraphQL door.
 *
 * Server query param is `project_id` (snake_case) per commonplace-api
 * `EditorInvalidationQuery` on Theorem main (#436).
 */
export function invalidationsUrlFrom(graphqlUrl: string, projectId?: string): string | undefined {
  let base: URL;
  try {
    base = new URL(graphqlUrl);
  } catch {
    return undefined;
  }
  base.pathname = EDITOR_INVALIDATIONS_PATH;
  base.search = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return base.toString();
}

/** Headers for GraphQL and authenticated SSE. */
export function substrateAuthHeaders(token?: string): Record<string, string> {
  if (!token) return {};
  return {
    'x-api-key': token,
    authorization: `Bearer ${token}`,
  };
}

export class SubstrateClient {
  private readonly options: SubstrateClientOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly subscriptions = new Map<string, Subscription<unknown>>();
  private source: EventSourceLike | null = null;
  private disposed = false;
  private fetchAbort: AbortController | null = null;

  constructor(options: SubstrateClientOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * One GraphQL round trip. Never throws for transport or protocol failure:
   * the honest degraded state is the return value.
   */
  async query<T>(
    document: string,
    variables: Record<string, unknown>,
    readGeneration: (data: T) => number | undefined = () => undefined,
  ): Promise<SubstrateResult<T>> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.options.endpoint.graphqlUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...substrateAuthHeaders(this.options.endpoint.token),
        },
        body: JSON.stringify({ query: document, variables }),
      });
    } catch (error) {
      return {
        ok: false,
        degradation: {
          level: 'unavailable',
          code: 'editor_substrate_unreachable',
          detail: `${this.options.endpoint.graphqlUrl}: ${describe(error)}`,
        },
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        degradation: {
          level: 'unavailable',
          code: 'editor_substrate_unreachable',
          detail: `${this.options.endpoint.graphqlUrl} answered ${response.status}`,
        },
      };
    }

    let envelope: GraphQlEnvelope<T>;
    try {
      envelope = (await response.json()) as GraphQlEnvelope<T>;
    } catch (error) {
      return {
        ok: false,
        degradation: {
          level: 'unavailable',
          code: 'editor_substrate_unreadable',
          detail: describe(error),
        },
      };
    }

    if (envelope.errors?.length || envelope.data == null) {
      return {
        ok: false,
        degradation: {
          level: 'unavailable',
          code: 'editor_substrate_query_failed',
          detail: envelope.errors?.[0]?.message ?? 'the query returned no data',
        },
      };
    }

    return {
      ok: true,
      data: envelope.data,
      generation: readGeneration(envelope.data) ?? NO_GENERATION,
    };
  }

  subscribe<T>(
    key: string,
    run: () => Promise<SubstrateResult<T>>,
    deliver: (result: SubstrateResult<T>) => void,
    options: SubscribeOptions = {},
  ): Unsubscribe {
    const subscription: Subscription<T> = {
      run,
      deliver,
      seen: NO_GENERATION,
      ...(options.path ? { path: options.path } : {}),
    };
    this.subscriptions.set(key, subscription as Subscription<unknown>);
    this.ensureChangefeed();
    void this.refresh(key);
    return () => {
      this.subscriptions.delete(key);
      if (this.subscriptions.size === 0) this.closeChangefeed();
    };
  }

  async refresh(key: string): Promise<void> {
    const subscription = this.subscriptions.get(key);
    if (!subscription) return;
    const result = await subscription.run();
    if (!this.subscriptions.has(key)) return;

    if (result.ok) {
      if (isStaleGeneration(subscription.seen, result.generation)) {
        this.log(
          `discarded stale answer for ${key}: generation ${result.generation} < ${subscription.seen}`,
        );
        return;
      }
      subscription.seen = result.generation;
    }
    subscription.deliver(result);
  }

  async refreshPath(path: string): Promise<void> {
    const keys = [...this.subscriptions.entries()]
      .filter(([, subscription]) => subscription.path === undefined || subscription.path === path)
      .map(([key]) => key);
    await Promise.all(keys.map((key) => this.refresh(key)));
  }

  async refreshAll(): Promise<void> {
    await Promise.all([...this.subscriptions.keys()].map((key) => this.refresh(key)));
  }

  dispose(): void {
    this.disposed = true;
    this.subscriptions.clear();
    this.closeChangefeed();
  }

  private ensureChangefeed(): void {
    if (this.disposed || this.source || this.fetchAbort) return;
    const url = this.options.endpoint.invalidationsUrl
      ?? invalidationsUrlFrom(this.options.endpoint.graphqlUrl, this.options.endpoint.projectId);
    if (!url) {
      this.options.onChangefeedStatus?.('idle');
      return;
    }

    const Impl = this.options.EventSourceImpl;
    if (Impl) {
      this.options.onChangefeedStatus?.('connecting');
      const source = new Impl(url);
      this.source = source;
      source.onopen = () => this.options.onChangefeedStatus?.('live');
      source.onerror = () => this.options.onChangefeedStatus?.('stale');
      source.addEventListener('message', (event) => this.onInvalidationFrame(event.data));
      return;
    }

    // Node / code-server: no header-capable EventSource. Stream with fetch.
    if (!this.options.endpoint.token) {
      this.options.onChangefeedStatus?.('idle');
      this.log('invalidations: idle (no token for authenticated SSE; EventSource unavailable)');
      return;
    }
    void this.openFetchChangefeed(url);
  }

  private async openFetchChangefeed(url: string): Promise<void> {
    if (this.disposed || this.fetchAbort) return;
    const abort = new AbortController();
    this.fetchAbort = abort;
    this.options.onChangefeedStatus?.('connecting');
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          accept: 'text/event-stream',
          ...substrateAuthHeaders(this.options.endpoint.token),
        },
        signal: abort.signal,
      });
      if (!response.ok || !response.body) {
        this.options.onChangefeedStatus?.('stale');
        this.log(`invalidations: fetch SSE answered ${response.status}`);
        this.fetchAbort = null;
        return;
      }
      this.options.onChangefeedStatus?.('live');
      await consumeSse(response.body, (data) => this.onInvalidationFrame(data), abort.signal);
    } catch (error) {
      if (!abort.signal.aborted) {
        this.options.onChangefeedStatus?.('stale');
        this.log(`invalidations: ${describe(error)}`);
      }
    } finally {
      if (this.fetchAbort === abort) this.fetchAbort = null;
    }
  }

  private onInvalidationFrame(data: string): void {
    const invalidation = parseEditorInvalidation(data);
    if (!invalidation) {
      this.log('invalidation frame not understood; refreshing every standing query');
      void this.refreshAll();
      return;
    }
    void this.refreshPath(invalidation.path);
  }

  private closeChangefeed(): void {
    this.source?.close();
    this.source = null;
    this.fetchAbort?.abort();
    this.fetchAbort = null;
    this.options.onChangefeedStatus?.('idle');
  }

  private log(message: string): void {
    this.options.log?.(message);
  }
}

async function consumeSse(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf('\n\n');
    while (split !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart());
      if (dataLines.length > 0) onData(dataLines.join('\n'));
      split = buffer.indexOf('\n\n');
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
