// SOURCING: hand-roll — CommonplaceHost is the SPEC-COMMONPLACE-NATIVE-SHELL-1.0
// B1 durable host contract. No upstream library models this three-adapter bridge
// (Web / Tauri / Gpui); the interface is the product seam.

/** Host-bridge contract types for SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B1. */

export type ObjectId = string;
export type WorkspaceId = string;
export type BlockKind = string;
export type CapabilityName = string;

export interface ObjectQuery {
  /** Free-text or structured filter. Empty string means match all. */
  text?: string;
  kinds?: string[];
  ids?: ObjectId[];
  limit?: number;
}

export interface HostObject {
  id: ObjectId;
  kind: string;
  title: string;
  body?: string;
  attrs?: Record<string, unknown>;
}

export interface ObjectSet {
  objects: HostObject[];
  total: number;
}

export interface CapabilityInvocation {
  capability: CapabilityName;
  args?: Record<string, unknown>;
}

export interface CapabilityReceipt {
  capability: CapabilityName;
  ok: boolean;
  detail?: string;
  payload?: Record<string, unknown>;
}

export type WorkspaceEvent =
  | { type: "layout"; layout: WorkspaceLayout }
  | { type: "block_placed"; block: BlockInstance }
  | { type: "presence"; presence: HostPresence }
  | { type: "lens"; lens: HostLens }
  | { type: "extension_points"; contributions: ExtensionContribution[] }
  | { type: "workspace_reset"; workspaceId: WorkspaceId };

export interface BlockPlacementRequest {
  workspaceId: WorkspaceId;
  kind: BlockKind;
  /** Optional client-suggested id; substrate may assign canonical id. */
  id?: string;
  attrs?: Record<string, unknown>;
  grants?: string[];
}

export interface BlockInstance {
  id: string;
  workspaceId: WorkspaceId;
  kind: BlockKind;
  attrs: Record<string, unknown>;
  grants: string[];
}

export interface WorkspaceLayout {
  workspaceId: WorkspaceId;
  /** Opaque JSON layout tree owned by the substrate. */
  tree: unknown;
  revisedAt: string;
}

export type OpenTarget =
  | { kind: "url"; url: string }
  | { kind: "ask"; query: string }
  | { kind: "find"; query: string; scope?: string }
  | { kind: "block"; blockId: string }
  | { kind: "workspace"; workspaceId: WorkspaceId };

export interface HostPresence {
  surface: string;
  state: "idle" | "acting" | "frozen" | "handoff";
  anchor?: { x: number; y: number };
  frozen: boolean;
  intent?: string;
}

export interface HostLens {
  surface: string;
  spans: Array<{ start: number; end: number; quote?: string }>;
}

export interface ExtensionContribution {
  id: string;
  paneKind?: string;
  composerVerb?: string;
  label: string;
}

/**
 * Browser-independent host contract. The React app never knows which adapter
 * implements this surface.
 */
export interface CommonplaceHost {
  queryObjects(q: ObjectQuery): Promise<ObjectSet>;
  invokeCapability(r: CapabilityInvocation): Promise<CapabilityReceipt>;
  subscribeWorkspace(
    id: WorkspaceId,
    listener: (e: WorkspaceEvent) => void,
  ): () => void;
  placeBlock(r: BlockPlacementRequest): Promise<BlockInstance>;
  persistLayout(l: WorkspaceLayout): Promise<void>;
  openTarget(t: OpenTarget): Promise<void>;
}
