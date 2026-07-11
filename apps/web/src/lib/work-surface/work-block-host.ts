/**
 * WS3 WorkBlockHost: the real BlockHost implementation for tool-call cards
 * in the thread. Unlike OperatorBlockHost (in-memory, always-synchronous
 * data from the Operator page's own state), this host hits the live
 * commonplace-api through the same-origin proxy routes via object-client.ts
 * (query|action|views), matching the SPEC-OBJECT-CONTRACT-V2 contract.
 *
 * `viewsFor` in the BlockHost interface is synchronous, but the view
 * catalog can only be known after a network round trip. The host kicks off
 * fetchObjectViews() once at construction and caches the result; until it
 * resolves, viewsFor returns [] (an honest "no known views yet" answer
 * rather than a fabricated one). The wire ViewDescriptor has no working
 * `render` (functions cannot cross JSON), so a placeholder is attached —
 * ObjectSetToolUI resolves the real renderer component itself via
 * resolveSurfaceRenderer(descriptor.renderer), the same seam
 * SurfaceRenderer.tsx uses, never descriptor.render.
 */

import type {
  BlockHost,
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectSet,
  ObjectShape,
  Result,
  ThemeTokens,
  ViewDescriptor,
} from '@/lib/block-view/types';
import { emitObjectAction, fetchObjectViews, queryObjects } from './object-client';
import { pickView } from './shape-match';

const NOOP_UNSUB = () => {};

// Same CSS-var token convention OperatorBlockHost uses app-wide.
const WORK_TOKENS: ThemeTokens = {
  color: { ground: 'var(--g0)', ink: 'var(--ink)', accent: 'var(--accent)' },
  space: { u: 'var(--u)' },
  typography: { body: 'var(--font-body)', display: 'var(--font-display)' },
  radius: { band: 'var(--r-band)' },
};

function withPlaceholderRender(descriptor: ViewDescriptor): ViewDescriptor {
  if (descriptor.render) return descriptor;
  return { ...descriptor, render: (() => null) as unknown as ViewDescriptor['render'] };
}

export interface WorkBlockHost extends BlockHost {
  /** True once the /objects/views catalog fetch has settled (success or failure). */
  readonly viewsLoaded: boolean;
}

class RealWorkBlockHost implements WorkBlockHost {
  readonly tokens = WORK_TOKENS;
  private cachedViews: readonly ViewDescriptor[] = [];
  private loaded = false;

  constructor() {
    void fetchObjectViews()
      .then((views) => {
        this.cachedViews = views.map(withPlaceholderRender);
      })
      .catch(() => {
        this.cachedViews = [];
      })
      .finally(() => {
        this.loaded = true;
      });
  }

  get viewsLoaded(): boolean {
    return this.loaded;
  }

  async query(query: ObjectQuery): Promise<ObjectSet> {
    const wire = await queryObjects(query);
    return { ...wire, subscribe: () => NOOP_UNSUB };
  }

  async emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    try {
      const value = await emitObjectAction(action);
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Action failed.' };
    }
  }

  viewsFor(shape: ObjectShape): readonly ViewDescriptor[] {
    return this.cachedViews.filter((view) => pickView([view], shape) !== null);
  }
}

/** Fresh host instance. Exposed for tests and for callers that want isolation. */
export function createWorkBlockHost(): WorkBlockHost {
  return new RealWorkBlockHost();
}

let singleton: WorkBlockHost | null = null;

/** Shared host for the /v2/work route, so every tool card reuses one view-catalog fetch. */
export function getWorkBlockHost(): WorkBlockHost {
  if (!singleton) singleton = createWorkBlockHost();
  return singleton;
}
