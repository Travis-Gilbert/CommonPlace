// SOURCING: hand-roll. GpuiHostAdapter is the typed loopback IPC face of
// CommonplaceHost for the GPUI edition (SPEC B1/B6). Production uses the
// authenticated WebSocket loopback transport; tests may keep using LoopbackHost.

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
} from "../types";
import { LoopbackHost, type LoopbackStore } from "../loopback";
import type { GpuiHostTransport } from "./gpui-transport";

function isTransport(
  value: LoopbackStore | GpuiHostTransport | undefined,
): value is GpuiHostTransport {
  return Boolean(
    value &&
      "request" in value &&
      typeof (value as GpuiHostTransport).request === "function",
  );
}

/**
 * GPUI edition adapter. The CommonplaceHost surface stays identical whether it
 * is backed by the production socket or the in-memory conformance harness.
 */
export class GpuiHostAdapter implements CommonplaceHost {
  readonly loopback: LoopbackHost | null;
  private readonly transport: GpuiHostTransport | null;

  constructor(backend?: LoopbackStore | GpuiHostTransport) {
    this.transport = isTransport(backend) ? backend : null;
    this.loopback = this.transport
      ? null
      : new LoopbackHost(backend as LoopbackStore | undefined);
  }

  queryObjects(q: ObjectQuery): Promise<ObjectSet> {
    return this.transport
      ? this.transport.request<ObjectSet>("queryObjects", { q })
      : this.loopback!.queryObjects(q);
  }

  invokeCapability(r: CapabilityInvocation): Promise<CapabilityReceipt> {
    return this.transport
      ? this.transport.request<CapabilityReceipt>("invokeCapability", { r })
      : this.loopback!.invokeCapability(r);
  }

  subscribeWorkspace(
    id: WorkspaceId,
    listener: (e: WorkspaceEvent) => void,
  ): () => void {
    return this.transport
      ? this.transport.subscribeWorkspace(id, listener)
      : this.loopback!.subscribeWorkspace(id, listener);
  }

  placeBlock(r: BlockPlacementRequest): Promise<BlockInstance> {
    return this.transport
      ? this.transport.request<BlockInstance>("placeBlock", { r })
      : this.loopback!.placeBlock(r);
  }

  persistLayout(l: WorkspaceLayout): Promise<void> {
    return this.transport
      ? this.transport.request<void>("persistLayout", { l })
      : this.loopback!.persistLayout(l);
  }

  openTarget(t: OpenTarget): Promise<void> {
    return this.transport
      ? this.transport.request<void>("openTarget", { t })
      : this.loopback!.openTarget(t);
  }

  publishPresence(workspaceId: WorkspaceId, presence: HostPresence): void {
    if (this.transport) {
      this.transport.publishPresence(workspaceId, presence);
    } else {
      this.loopback!.publishPresence(workspaceId, presence);
    }
  }

  publishLens(workspaceId: WorkspaceId, lens: HostLens): void {
    if (this.transport) {
      this.transport.publishLens(workspaceId, lens);
    } else {
      this.loopback!.publishLens(workspaceId, lens);
    }
  }
}
