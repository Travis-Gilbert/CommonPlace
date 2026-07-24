// SOURCING: none — package barrel for @commonplace/host-bridge.

export type {
  BlockInstance,
  BlockKind,
  BlockPlacementRequest,
  CapabilityInvocation,
  CapabilityName,
  CapabilityReceipt,
  CommonplaceHost,
  ExtensionContribution,
  HostLens,
  HostObject,
  HostPresence,
  ObjectId,
  ObjectQuery,
  ObjectSet,
  OpenTarget,
  WorkspaceEvent,
  WorkspaceId,
  WorkspaceLayout,
} from "./types.js";

export {
  LoopbackHost,
  createLoopbackStore,
  type LoopbackStore,
} from "./loopback.js";

export { WebHostAdapter, type WebHostTransport } from "./adapters/web.js";
export { TauriHostAdapter, type TauriInvoker } from "./adapters/tauri.js";
export { GpuiHostAdapter } from "./adapters/gpui.js";

export { runAdapterConformance } from "./conformance.js";

/** Adapters that can push presence/lens into React subscribers (SPEC F1). */
export type HostEventPublisher = {
  publishPresence(
    workspaceId: string,
    presence: import("./types.js").HostPresence,
  ): void;
  publishLens(workspaceId: string, lens: import("./types.js").HostLens): void;
};

export function asHostEventPublisher(
  host: unknown,
): HostEventPublisher | null {
  if (
    host &&
    typeof host === "object" &&
    "publishPresence" in host &&
    "publishLens" in host &&
    typeof (host as HostEventPublisher).publishPresence === "function" &&
    typeof (host as HostEventPublisher).publishLens === "function"
  ) {
    return host as HostEventPublisher;
  }
  return null;
}
