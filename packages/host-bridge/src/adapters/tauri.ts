// SOURCING: hand-roll — TauriHostAdapter speaks the existing desktop invoke
// surface (`apps/web/src/lib/desktop.ts` pattern) through an injected invoker.
// The adapter is the SPEC B1 Tauri edition of CommonplaceHost; no library owns
// this product bridge.

import type {
  BlockPlacementRequest,
  BlockInstance,
  CapabilityInvocation,
  CapabilityReceipt,
  CommonplaceHost,
  HostLens,
  HostPresence,
  ObjectQuery,
  ObjectSet,
  OpenTarget,
  WorkspaceEvent,
  WorkspaceId,
  WorkspaceLayout,
} from "../types.js";
import { LoopbackHost, type LoopbackStore } from "../loopback.js";

export type TauriInvoker = <T>(
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<T>;

/**
 * Desktop (Tauri) adapter. Prefer host commands when the invoker is present;
 * fall back to the shared loopback substrate for layout/blocks so the React
 * surface stays host-agnostic during the migration.
 */
export class TauriHostAdapter implements CommonplaceHost {
  private readonly local: LoopbackHost;

  constructor(
    private readonly invoke: TauriInvoker | null,
    store?: LoopbackStore,
  ) {
    this.local = new LoopbackHost(store);
  }

  async queryObjects(q: ObjectQuery): Promise<ObjectSet> {
    if (this.invoke) {
      try {
        return await this.invoke<ObjectSet>("host_query_objects", { q });
      } catch {
        // Command not yet registered in the shell: fall through.
      }
    }
    return this.local.queryObjects(q);
  }

  async invokeCapability(r: CapabilityInvocation): Promise<CapabilityReceipt> {
    if (this.invoke) {
      try {
        return await this.invoke<CapabilityReceipt>("host_invoke_capability", {
          r,
        });
      } catch {
        // fall through
      }
    }
    return this.local.invokeCapability(r);
  }

  subscribeWorkspace(
    id: WorkspaceId,
    listener: (e: WorkspaceEvent) => void,
  ): () => void {
    return this.local.subscribeWorkspace(id, listener);
  }

  placeBlock(r: BlockPlacementRequest): Promise<BlockInstance> {
    return this.local.placeBlock(r);
  }

  persistLayout(l: WorkspaceLayout): Promise<void> {
    return this.local.persistLayout(l);
  }

  async openTarget(t: OpenTarget): Promise<void> {
    if (this.invoke) {
      try {
        await this.invoke<void>("host_open_target", { t });
        return;
      } catch {
        // fall through
      }
    }
    return this.local.openTarget(t);
  }

  publishPresence(workspaceId: WorkspaceId, presence: HostPresence): void {
    this.local.publishPresence(workspaceId, presence);
  }

  publishLens(workspaceId: WorkspaceId, lens: HostLens): void {
    this.local.publishLens(workspaceId, lens);
  }
}
