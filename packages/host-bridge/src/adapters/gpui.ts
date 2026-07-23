// SOURCING: hand-roll — GpuiHostAdapter is the typed loopback IPC face of
// CommonplaceHost for the GPUI edition (SPEC B1/B6). Transport is an in-process
// LoopbackHost until the native typed socket lands; no upstream library models
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

/**
 * GPUI edition adapter. Speaks the same CommonplaceHost methods over the
 * shared loopback substrate (stand-in for typed loopback IPC). Conformance
 * suite runs against this class directly.
 */
export class GpuiHostAdapter implements CommonplaceHost {
  readonly loopback: LoopbackHost;

  constructor(store?: LoopbackStore) {
    this.loopback = new LoopbackHost(store);
  }

  queryObjects(q: ObjectQuery): Promise<ObjectSet> {
    return this.loopback.queryObjects(q);
  }

  invokeCapability(r: CapabilityInvocation): Promise<CapabilityReceipt> {
    return this.loopback.invokeCapability(r);
  }

  subscribeWorkspace(
    id: WorkspaceId,
    listener: (e: WorkspaceEvent) => void,
  ): () => void {
    return this.loopback.subscribeWorkspace(id, listener);
  }

  placeBlock(r: BlockPlacementRequest): Promise<BlockInstance> {
    return this.loopback.placeBlock(r);
  }

  persistLayout(l: WorkspaceLayout): Promise<void> {
    return this.loopback.persistLayout(l);
  }

  openTarget(t: OpenTarget): Promise<void> {
    return this.loopback.openTarget(t);
  }

  publishPresence(workspaceId: WorkspaceId, presence: HostPresence): void {
    this.loopback.publishPresence(workspaceId, presence);
  }

  publishLens(workspaceId: WorkspaceId, lens: HostLens): void {
    this.loopback.publishLens(workspaceId, lens);
  }
}
