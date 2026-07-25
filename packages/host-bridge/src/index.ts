// SOURCING: none. Package barrel for @commonplace/host-bridge.

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
} from "./types";

export {
  LoopbackHost,
  createLoopbackStore,
  type LoopbackStore,
} from "./loopback";

export { WebHostAdapter, type WebHostTransport } from "./adapters/web";
export { TauriHostAdapter, type TauriInvoker } from "./adapters/tauri";
export { GpuiHostAdapter } from "./adapters/gpui";
export {
  GPUI_BRIDGE_VERSION,
  WebSocketGpuiTransport,
  type GpuiHostMethod,
  type GpuiHostTransport,
  type GpuiRuntimeConfig,
} from "./adapters/gpui-transport";

export { runAdapterConformance } from "./conformance";

/** Adapters that can push presence/lens into React subscribers (SPEC F1). */
export type HostEventPublisher = {
  publishPresence(
    workspaceId: string,
    presence: import("./types").HostPresence,
  ): void;
  publishLens(workspaceId: string, lens: import("./types").HostLens): void;
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
