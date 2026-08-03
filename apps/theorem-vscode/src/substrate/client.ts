// SOURCING: none. Transport glue over fetch and EventSource, both platform
// APIs available in the extension host; no upstream client library applies.
/**
 * V1. The standing-query client for the extension host.
 *
 * SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 named choice 4: the pack speaks GraphQL
 * plus standing-query subscriptions to `commonplace-api`, generation stamps and
 * Degradation travel intact, stale generations are discarded client-side, and
 * LSP appears nowhere. Every provider in V2 through V6 consumes this one client.
 *
 * Four properties are load-bearing and each is asserted in `substrate.test.ts`:
 *
 * - **No polling.** Freshness comes from the editor invalidation door at
 *   `/v1/editor/invalidations`: one SSE connection, and a subscription
 *   re-queries authoritatively rather than patching rows in place. This mirrors
 *   `packages/block-view/src/host/changefeed.ts`, which already made this choice
 *   for block bodies. `EventSource` reconnects on its own, so there is no timer
 *   here to lose track of.
 * - **An invalidation names its file.** The event carries `path`, so a change to
 *   one file re-queries that file's standing queries and leaves the rest alone.
 *   The earlier shape had no path and had to refresh everything; with twenty
 *   open editors that was twenty times the work per keystroke elsewhere.
 * - **Stale answers are dropped.** Each subscription key carries the highest
 *   generation it has seen; a response stamped below it is discarded and logged
 *   rather than rendered. Two in-flight queries returning out of order is the
 *   normal case, not the exceptional one.
 * - **A dead endpoint is a value.** Failures resolve to `{ ok: false,
 *   degradation }` carrying the door, status, and reason. Nothing here returns
 *   an empty result set for a request that never landed.
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
  /** Console session token. Sent as a bearer header when present. */
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
 * Both are served by the same `commonplace-api` process, so one configured URL
 * is enough in the common case; an explicit `invalidationsUrl` still wins when
 * they are split behind different routes.
 */
export function invalidationsUrlFrom(graphqlUrl: string, projectId?: string): string | undefined {
  let base: URL;
  try {
    base = new URL(graphqlUrl);
  } catch {
    return undefined;
  }
  base.pathname = EDITOR_INVALIDATIONS_PATH;
  base.search = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return base.toString();
}

export class SubstrateClient {
  private readonly options: SubstrateClientOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly subscriptions = new Map<string, Subscription<unknown>>();
  private source: EventSourceLike | null = null;
  private disposed = false;

  constructor(options: SubstrateClientOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /**
   * One GraphQL round trip. Never throws for transport or protocol failure:
   * the honest degraded state is the return value.
   *
   * `readGeneration` pulls the stamp out of whatever the document selected;
   * a document with no generation field reports NO_GENERATION, which never
   * looks stale and never suppresses a later answer.
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
          ...(this.options.endpoint.token
            ? { authorization: `Bearer ${this.options.endpoint.token}` }
            : {}),
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

  /**
   * Register a standing query. Runs immediately, then again on every
   * invalidation that names its path, delivering only answers at or above the
   * highest generation this key has already seen.
   */
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

  /** Re-run one subscription. Exposed for the invalidation path and for tests. */
  async refresh(key: string): Promise<void> {
    const subscription = this.subscriptions.get(key);
    if (!subscription) return;
    const result = await subscription.run();
    if (!this.subscriptions.has(key)) return; // unsubscribed while in flight

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

  /**
   * Re-run the standing queries an invalidation touches: those bound to the
   * named path, plus every workspace-wide query, which has no narrower signal
   * to wait for.
   */
  async refreshPath(path: string): Promise<void> {
    const keys = [...this.subscriptions.entries()]
      .filter(([, subscription]) => subscription.path === undefined || subscription.path === path)
      .map(([key]) => key);
    await Promise.all(keys.map((key) => this.refresh(key)));
  }

  /** Re-run every standing query. The fallback when an event says nothing usable. */
  async refreshAll(): Promise<void> {
    await Promise.all([...this.subscriptions.keys()].map((key) => this.refresh(key)));
  }

  dispose(): void {
    this.disposed = true;
    this.subscriptions.clear();
    this.closeChangefeed();
  }

  private ensureChangefeed(): void {
    if (this.disposed || this.source) return;
    const url = this.options.endpoint.invalidationsUrl
      ?? invalidationsUrlFrom(this.options.endpoint.graphqlUrl, this.options.endpoint.projectId);
    const Impl = this.options.EventSourceImpl;
    if (!url || !Impl) {
      // No push door configured. Subscriptions still answer once; freshness
      // then depends on explicit refresh, and the status says so rather than
      // a timer quietly appearing here.
      this.options.onChangefeedStatus?.('idle');
      return;
    }

    this.options.onChangefeedStatus?.('connecting');
    const source = new Impl(url);
    this.source = source;
    source.onopen = () => this.options.onChangefeedStatus?.('live');
    source.onerror = () => this.options.onChangefeedStatus?.('stale');
    source.addEventListener('message', (event) => {
      const invalidation = parseEditorInvalidation(event.data);
      if (!invalidation) {
        // The stream opens with a comment and may carry frames this version
        // does not model. Something changed and the client cannot tell what,
        // so it re-reads everything rather than silently going stale.
        this.log('invalidation frame not understood; refreshing every standing query');
        void this.refreshAll();
        return;
      }
      void this.refreshPath(invalidation.path);
    });
  }

  private closeChangefeed(): void {
    this.source?.close();
    this.source = null;
    this.options.onChangefeedStatus?.('idle');
  }

  private log(message: string): void {
    this.options.log?.(message);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
