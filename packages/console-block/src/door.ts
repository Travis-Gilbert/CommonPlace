import { loadConsoleWasm, type ConsoleWasmRuntime } from './wasm-fixture';
import { CORPUS_READ_GRANT } from './plugin';
import type {
  ConsoleSnapshot,
  EntityDetail,
  GraphSlice,
  Page,
  ReceiptFilter,
  ReceiptPage,
  StandingFiring,
  StoreOverview,
} from './types';
import { isConsoleSnapshot } from './types';

export type ConsoleDoorErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'
  | 'unavailable'
  | 'protocol';

export class ConsoleDoorError extends Error {
  readonly code: ConsoleDoorErrorCode;
  readonly retryable: boolean;

  constructor(code: ConsoleDoorErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'ConsoleDoorError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface ConsoleDoorCapabilities {
  readonly authenticated: boolean;
  readonly read_only: true;
  readonly fixture: boolean;
  readonly transport: 'wasm-fixture' | 'same-origin-graphql';
  readonly grants: readonly string[];
}

export interface WatchRequest {
  readonly query_id: string;
  readonly from_sequence?: number;
}

export interface ConsoleDoor {
  readonly capabilities: ConsoleDoorCapabilities;
  snapshot(): Promise<ConsoleSnapshot>;
  overview(): Promise<StoreOverview>;
  entity(id: string): Promise<EntityDetail>;
  receipts(filter: ReceiptFilter, page: Page): Promise<ReceiptPage>;
  neighborhood(root: string, depth: number): Promise<GraphSlice>;
  subscribe(
    request: WatchRequest,
    listener: (event: StandingFiring) => void,
  ): Promise<() => void>;
}

function assertCorpusRead(grants: readonly string[]): void {
  if (!grants.includes(CORPUS_READ_GRANT)) {
    throw new ConsoleDoorError('forbidden', 'The console requires the corpus:read grant');
  }
}

export class WasmFixtureDoor implements ConsoleDoor {
  readonly capabilities: ConsoleDoorCapabilities;
  readonly #runtime: Promise<ConsoleWasmRuntime>;
  readonly #listeners = new Map<string, Set<(event: StandingFiring) => void>>();

  constructor(
    grants: readonly string[],
    runtime: Promise<ConsoleWasmRuntime> = loadConsoleWasm(),
  ) {
    this.capabilities = {
      authenticated: false,
      read_only: true,
      fixture: true,
      transport: 'wasm-fixture',
      grants: [...grants],
    };
    this.#runtime = runtime;
  }

  async snapshot(): Promise<ConsoleSnapshot> {
    assertCorpusRead(this.capabilities.grants);
    return (await this.#runtime).snapshot;
  }

  async overview(): Promise<StoreOverview> {
    return (await this.snapshot()).overview;
  }

  async entity(id: string): Promise<EntityDetail> {
    const detail = (await this.snapshot()).entities.find((entity) => entity.record.id === id);
    if (!detail) throw new ConsoleDoorError('not_found', `Entity ${id} was not found`);
    return detail;
  }

  async receipts(filter: ReceiptFilter, page: Page): Promise<ReceiptPage> {
    if (!Number.isInteger(page.limit) || page.limit < 1 || page.limit > 250) {
      throw new ConsoleDoorError(
        'invalid_request',
        'Receipt page limit must be between 1 and 250',
      );
    }
    const offset = page.cursor === undefined ? 0 : Number(page.cursor);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ConsoleDoorError('invalid_request', 'Receipt cursor must be a decimal offset');
    }
    const matching = (await this.snapshot()).receipts.filter(
      (receipt) =>
        (filter.kind === undefined || receipt.kind === filter.kind) &&
        (filter.subject_id === undefined || receipt.subject_id === filter.subject_id),
    );
    if (offset > matching.length) {
      throw new ConsoleDoorError('invalid_request', 'Receipt cursor is beyond the result set');
    }
    const end = Math.min(offset + page.limit, matching.length);
    return {
      receipts: matching.slice(offset, end),
      next_cursor: end < matching.length ? String(end) : undefined,
      total: matching.length,
    };
  }

  async neighborhood(root: string, depth: number): Promise<GraphSlice> {
    const graph = (await this.snapshot()).graph;
    if (!graph.nodes.some((node) => node.id === root)) {
      throw new ConsoleDoorError('not_found', `Graph node ${root} was not found`);
    }
    if (!Number.isInteger(depth) || depth < 0 || depth > 8) {
      throw new ConsoleDoorError('invalid_request', 'Graph depth must be between 0 and 8');
    }
    const included = new Set([root]);
    const queue: Array<readonly [string, number]> = [[root, 0]];
    while (queue.length > 0) {
      const [current, currentDepth] = queue.shift()!;
      if (currentDepth >= depth) continue;
      for (const edge of graph.edges) {
        const neighbor =
          edge.source === current
            ? edge.target
            : edge.target === current
              ? edge.source
              : undefined;
        if (neighbor && !included.has(neighbor)) {
          included.add(neighbor);
          queue.push([neighbor, currentDepth + 1]);
        }
      }
    }
    return {
      root,
      depth,
      nodes: graph.nodes.filter((node) => included.has(node.id)),
      edges: graph.edges.filter(
        (edge) => included.has(edge.source) && included.has(edge.target),
      ),
    };
  }

  async subscribe(
    request: WatchRequest,
    listener: (event: StandingFiring) => void,
  ): Promise<() => void> {
    const snapshot = await this.snapshot();
    if (!snapshot.standing_queries.some((query) => query.id === request.query_id)) {
      throw new ConsoleDoorError(
        'not_found',
        `Standing query ${request.query_id} was not found`,
      );
    }
    const listeners = this.#listeners.get(request.query_id) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(request.query_id, listeners);
    for (const event of snapshot.firings) {
      if (
        event.query_id === request.query_id &&
        event.sequence >= (request.from_sequence ?? 0)
      ) {
        listener(event);
      }
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(request.query_id);
    };
  }

  emitFixtureFiring(event: StandingFiring): number {
    const listeners = this.#listeners.get(event.query_id);
    if (!listeners) return 0;
    for (const listener of listeners) listener(event);
    return listeners.size;
  }
}

export class SameOriginGraphqlDoor implements ConsoleDoor {
  readonly capabilities: ConsoleDoorCapabilities;
  readonly #endpoint: string;

  constructor(grants: readonly string[], endpoint = '/api/console-plugin/snapshot') {
    this.capabilities = {
      authenticated: true,
      read_only: true,
      fixture: false,
      transport: 'same-origin-graphql',
      grants: [...grants],
    };
    this.#endpoint = endpoint;
  }

  async snapshot(): Promise<ConsoleSnapshot> {
    assertCorpusRead(this.capabilities.grants);
    const response = await fetch(this.#endpoint, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new ConsoleDoorError(
        'unavailable',
        `Console GraphQL door is unavailable (${response.status})`,
        response.status >= 500,
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ConsoleDoorError('protocol', 'Console GraphQL door returned invalid JSON');
    }
    if (!isConsoleSnapshot(payload)) {
      throw new ConsoleDoorError(
        'protocol',
        'Console GraphQL door returned an invalid console snapshot',
      );
    }
    return payload;
  }

  async overview(): Promise<StoreOverview> {
    return (await this.snapshot()).overview;
  }

  async entity(id: string): Promise<EntityDetail> {
    const detail = (await this.snapshot()).entities.find((entity) => entity.record.id === id);
    if (!detail) throw new ConsoleDoorError('not_found', `Entity ${id} was not found`);
    return detail;
  }

  async receipts(filter: ReceiptFilter, page: Page): Promise<ReceiptPage> {
    const fixture = new WasmFixtureDoor(this.capabilities.grants, Promise.resolve({
      snapshot: await this.snapshot(),
      layoutFingerprint: () => 0n,
      settledLayoutFingerprint: () => 0n,
    }));
    return fixture.receipts(filter, page);
  }

  async neighborhood(root: string, depth: number): Promise<GraphSlice> {
    const fixture = new WasmFixtureDoor(this.capabilities.grants, Promise.resolve({
      snapshot: await this.snapshot(),
      layoutFingerprint: () => 0n,
      settledLayoutFingerprint: () => 0n,
    }));
    return fixture.neighborhood(root, depth);
  }

  async subscribe(): Promise<() => void> {
    throw new ConsoleDoorError(
      'unavailable',
      'The standing-query subscription door is not deployed on the current backend',
      true,
    );
  }
}
