// SOURCING: none — pure logic wrapping HTTP/GraphQL fetch deps injected by the
// caller. No upstream UI component applies; WebHostAdapter is the web transport
// for CommonplaceHost (SPEC B1). Console injects queryObjects via
// ConsoleBlockHost; other web surfaces inject their own transport.

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
 * Transport hooks the web app already owns. Injecting them keeps this package
 * free of Next.js / GraphQL client deps while still wrapping real call sites.
 */
export interface WebHostTransport {
  queryObjects(q: ObjectQuery): Promise<ObjectSet>;
  invokeCapability?(r: CapabilityInvocation): Promise<CapabilityReceipt>;
  openTarget?(t: OpenTarget): Promise<void>;
}

/**
 * Web edition adapter. Object queries go through the injected transport
 * (existing commonplace-graphql / commonplace-api). Layout, blocks, and
 * subscriptions use the shared loopback substrate until the durable workspace
 * API lands; that keeps adapter-conformance green without inventing a second
 * layout store in apps/web.
 */
export class WebHostAdapter implements CommonplaceHost {
  private readonly local: LoopbackHost;

  constructor(
    private readonly transport: WebHostTransport,
    store?: LoopbackStore,
  ) {
    this.local = new LoopbackHost(store);
  }

  queryObjects(q: ObjectQuery): Promise<ObjectSet> {
    return this.transport.queryObjects(q);
  }

  invokeCapability(r: CapabilityInvocation): Promise<CapabilityReceipt> {
    if (this.transport.invokeCapability) {
      return this.transport.invokeCapability(r);
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

  openTarget(t: OpenTarget): Promise<void> {
    if (this.transport.openTarget) return this.transport.openTarget(t);
    return this.local.openTarget(t);
  }

  /** Shell → React presence (SPEC F1). */
  publishPresence(workspaceId: WorkspaceId, presence: HostPresence): void {
    this.local.publishPresence(workspaceId, presence);
  }

  /** Shell → React find-highlight lens (SPEC F1). */
  publishLens(workspaceId: WorkspaceId, lens: HostLens): void {
    this.local.publishLens(workspaceId, lens);
  }
}
