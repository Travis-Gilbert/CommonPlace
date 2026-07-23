// SOURCING: none — pure in-memory substrate for the Gpui loopback harness and
// adapter conformance suite. No UI component applies.

/**
 * In-memory substrate used by the Gpui loopback harness and conformance suite.
 * Canonical workspace state lives here so a surface reload can re-subscribe
 * without losing blocks (SPEC B6 acceptance shape).
 */

import type {
  BlockInstance,
  BlockPlacementRequest,
  CapabilityInvocation,
  CapabilityReceipt,
  CommonplaceHost,
  ExtensionContribution,
  HostLens,
  HostPresence,
  ObjectQuery,
  ObjectSet,
  OpenTarget,
  WorkspaceEvent,
  WorkspaceId,
  WorkspaceLayout,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface LoopbackStore {
  objects: Map<string, { id: string; kind: string; title: string; body?: string }>;
  layouts: Map<WorkspaceId, WorkspaceLayout>;
  blocks: Map<string, BlockInstance>;
  contributions: ExtensionContribution[];
  openTargets: OpenTarget[];
}

export function createLoopbackStore(
  seed?: Partial<LoopbackStore>,
): LoopbackStore {
  return {
    objects: seed?.objects ?? new Map(),
    layouts: seed?.layouts ?? new Map(),
    blocks: seed?.blocks ?? new Map(),
    contributions: seed?.contributions ?? [],
    openTargets: seed?.openTargets ?? [],
  };
}

export class LoopbackHost implements CommonplaceHost {
  private readonly listeners = new Map<
    WorkspaceId,
    Set<(e: WorkspaceEvent) => void>
  >();

  constructor(readonly store: LoopbackStore = createLoopbackStore()) {}

  private emit(id: WorkspaceId, event: WorkspaceEvent): void {
    const set = this.listeners.get(id);
    if (!set) return;
    for (const listener of set) listener(event);
  }

  async queryObjects(q: ObjectQuery): Promise<ObjectSet> {
    let objects = [...this.store.objects.values()];
    if (q.ids?.length) {
      const want = new Set(q.ids);
      objects = objects.filter((o) => want.has(o.id));
    }
    if (q.kinds?.length) {
      const want = new Set(q.kinds);
      objects = objects.filter((o) => want.has(o.kind));
    }
    if (q.text) {
      const needle = q.text.toLowerCase();
      objects = objects.filter(
        (o) =>
          o.title.toLowerCase().includes(needle) ||
          (o.body ?? "").toLowerCase().includes(needle),
      );
    }
    const limit = q.limit ?? objects.length;
    return { objects: objects.slice(0, limit), total: objects.length };
  }

  async invokeCapability(r: CapabilityInvocation): Promise<CapabilityReceipt> {
    if (r.capability === "list_extension_points") {
      return {
        capability: r.capability,
        ok: true,
        payload: { contributions: this.store.contributions },
      };
    }
    return {
      capability: r.capability,
      ok: true,
      detail: "loopback_ack",
      payload: r.args,
    };
  }

  subscribeWorkspace(
    id: WorkspaceId,
    listener: (e: WorkspaceEvent) => void,
  ): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(listener);
    const layout = this.store.layouts.get(id);
    if (layout) listener({ type: "layout", layout });
    for (const block of this.store.blocks.values()) {
      if (block.workspaceId === id) {
        listener({ type: "block_placed", block });
      }
    }
    listener({
      type: "extension_points",
      contributions: this.store.contributions,
    });
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(id);
    };
  }

  async placeBlock(r: BlockPlacementRequest): Promise<BlockInstance> {
    const id = r.id ?? newId("block");
    const block: BlockInstance = {
      id,
      workspaceId: r.workspaceId,
      kind: r.kind,
      attrs: r.attrs ?? {},
      grants: r.grants ?? [],
    };
    this.store.blocks.set(id, block);
    this.emit(r.workspaceId, { type: "block_placed", block });
    return block;
  }

  async persistLayout(l: WorkspaceLayout): Promise<void> {
    const next: WorkspaceLayout = {
      ...l,
      revisedAt: l.revisedAt || nowIso(),
    };
    this.store.layouts.set(l.workspaceId, next);
    this.emit(l.workspaceId, { type: "layout", layout: next });
  }

  async openTarget(t: OpenTarget): Promise<void> {
    this.store.openTargets.push(t);
  }

  /** Test helper: install plugin contributions and notify subscribers. */
  setContributions(contributions: ExtensionContribution[]): void {
    this.store.contributions = contributions;
    for (const [workspaceId] of this.listeners) {
      this.emit(workspaceId, { type: "extension_points", contributions });
    }
  }

  /** Publish canonical agent presence to workspace subscribers (SPEC F1). */
  publishPresence(workspaceId: WorkspaceId, presence: HostPresence): void {
    this.emit(workspaceId, { type: "presence", presence });
  }

  /** Publish find-highlight lens events to workspace subscribers (SPEC F1). */
  publishLens(workspaceId: WorkspaceId, lens: HostLens): void {
    this.emit(workspaceId, { type: "lens", lens });
  }
}
