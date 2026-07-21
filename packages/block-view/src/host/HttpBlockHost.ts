'use client';

/**
 * HttpBlockHost — the live `BlockHost` over the Rust `commonplace-api` object
 * seam (SPEC-OBJECT-CONTRACT-V2). It rides the endpoints `crates/commonplace`'s
 * `CommonplaceBlockHost` exposes via `apps/commonplace-api`:
 *   POST /objects/query  { ObjectQuery }  -> ObjectSet
 *   POST /objects/action { ObjectAction } -> ObjectActionReceipt
 *   GET  /objects/views                    -> ViewDescriptor[]
 *
 * Swap this in where MemoryBlockHost is constructed and nothing above the
 * BlockHost seam changes — the SurfaceRenderer, the renderers, the surface
 * objects are identical. `viewsFor` returns client descriptors (the renderer
 * keys the module map knows); the server drives query/emit only.
 */

import type {
  BlockHost,
  JsonValue,
  ObjectAction,
  ObjectActionReceipt,
  ObjectCardinality,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  ObjectShape,
  Result,
  ThemeTokens,
  ViewDescriptor,
} from '../types';
import {
  type ChangefeedConnectionStatus,
  resolveChangefeedClient,
} from './changefeed';

const PORCELAIN_TOKENS: ThemeTokens = {
  color: { ground: 'var(--g0)', raised: 'var(--raised)', ink: 'var(--ink)', accent: 'var(--accent)' },
  space: { u: 'var(--u)' },
  typography: { body: 'var(--font-body)', display: 'var(--font-display)', mono: 'var(--font-mono)' },
  radius: { band: 'var(--r-band)', row: 'var(--r-row)' },
};

/** Client descriptors whose `renderer` keys resolve in SURFACE_RENDERER_MODULES.
 *  The server drives query/emit; which renderers exist is a client concern. */
function descriptor(id: string, name: string): ViewDescriptor {
  return {
    id,
    name,
    renderer: id,
    accepts: { cardinality: 'any' },
    emits: ['open', 'select', 'update', 'create'],
    source: { package: 'commonplace-api', component: id, mode: 'wrap', regime: 'css-vars' },
    render: (() => null) as unknown as ViewDescriptor['render'],
  };
}

const GENERIC_DESCRIPTORS: readonly ViewDescriptor[] = [
  descriptor('table', 'Table'),
  descriptor('card', 'Card'),
  descriptor('list', 'List'),
];

const EMPTY_SHAPE: ObjectShape = {
  types: [],
  fields: [],
  relations: [],
  axes: {},
  cardinality: 'empty',
};

interface RawObjectSet {
  readonly objects?: readonly ObjectRef[];
  readonly shape?: ObjectShape;
  readonly next_cursor?: string;
  readonly note?: string;
  readonly notes?: readonly string[];
}

export interface HttpBlockHostConfig {
  /** Base URL of the Rust commonplace-api (block-view seam), no trailing slash. */
  readonly baseUrl: string;
  /** The `x-api-key` the API gates on, if configured. */
  readonly apiKey?: string;
  /** THEOREM_PROACTIVITY_CHANGEFEED_URL: RustyRed `/v1/proactivity/stream`. */
  readonly changefeedUrl?: string;
  /** Changefeed connection health for footer status (not block body errors). */
  readonly onChangefeedStatus?: (status: ChangefeedConnectionStatus) => void;
  /** Observes every HTTP outcome: the response status, or null when the
   *  request itself failed (network down). Hosts surface transport health
   *  (e.g. 403 as an identity-refused state) without re-wrapping fetch. */
  readonly onStatus?: (status: number | null) => void;
}

const LAYOUT_TYPES = new Set(['surface', 'region', 'view-instance']);

export class HttpBlockHost implements BlockHost {
  readonly tokens: ThemeTokens = PORCELAIN_TOKENS;
  private readonly changefeed;

  /** @param surfaceObjects the arrangement, served locally; only the domain
   *  data (a view-instance's ObjectQuery) travels to the substrate. Once
   *  surface objects are persisted server-side, drop this and query them too. */
  constructor(
    private readonly config: HttpBlockHostConfig,
    private readonly surfaceObjects: readonly ObjectRef[] = [],
  ) {
    this.changefeed = resolveChangefeedClient({
      url: this.config.changefeedUrl,
      onStatus: this.config.onChangefeedStatus,
    });
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers['x-api-key'] = this.config.apiKey;
    return headers;
  }

  async query(query: ObjectQuery): Promise<ObjectSet> {
    if (query.types.some((type) => LAYOUT_TYPES.has(type))) {
      return {
        objects: this.surfaceObjects,
        shape: {
          ...EMPTY_SHAPE,
          types: [...query.types],
          cardinality: this.surfaceObjects.length ? 'many' : 'empty',
        },
        subscribe: () => () => {},
      };
    }
    const raw = await this.fetchRawObjectSet(query);
    return this.adapt(raw, query);
  }

  private async fetchRawObjectSet(query: ObjectQuery): Promise<RawObjectSet> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/objects/query`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(query),
      });
    } catch (error) {
      this.config.onStatus?.(null);
      throw error;
    }
    this.config.onStatus?.(response.status);
    if (!response.ok) throw new Error(`objects/query failed: ${response.status}`);
    return (await response.json()) as RawObjectSet;
  }

  async emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/objects/action`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(action),
      });
    } catch (error) {
      this.config.onStatus?.(null);
      return { ok: false, error: 'objects/action failed: network unreachable' };
    }
    this.config.onStatus?.(response.status);
    if (!response.ok) return { ok: false, error: `objects/action failed: ${response.status}` };
    return { ok: true, value: (await response.json()) as ObjectActionReceipt };
  }

  viewsFor(_shape: ObjectShape): readonly ViewDescriptor[] {
    return GENERIC_DESCRIPTORS;
  }

  /** Map the Rust ObjectSet JSON to the web contract: `note` (Option<String>)
   *  becomes the `notes` array the interpreter renders; live queries wire a
   *  changefeed subscription that re-queries on relevant invalidations. */
  private adapt(raw: RawObjectSet, query: ObjectQuery): ObjectSet {
    const notes = raw.notes ?? (typeof raw.note === 'string' ? [raw.note] : undefined);
    const objects = (raw.objects ?? []).map((object) => ({
      ...object,
      properties: (object.properties ?? {}) as Readonly<Record<string, JsonValue>>,
    }));
    const cardinality: ObjectCardinality =
      raw.shape?.cardinality ?? (objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many');
    const base: ObjectSet = {
      objects,
      shape: raw.shape ? { ...raw.shape, cardinality } : EMPTY_SHAPE,
      next_cursor: raw.next_cursor,
      notes,
      subscribe: () => () => {},
    };
    if (!query.live) return base;

    return {
      ...base,
      subscribe: (callback) =>
        this.changefeed.subscribe(query, () => {
          void this.fetchRawObjectSet(query)
            .then((nextRaw) => callback(this.adapt(nextRaw, query)))
            .catch(() => {
              // Silent degradation: stale bodies stay intact; status is external.
            });
        }),
    };
  }
}
