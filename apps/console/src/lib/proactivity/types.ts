// SOURCING: none. Shared denormalized projection contract. It contains no
// credential, tenant input, or server-only import, so client graph rendering
// can consume it without crossing the harness boundary.

export interface ProactivityGraphNode {
  readonly id: string;
  readonly kind: 'stake' | 'source' | 'watch' | 'judgment' | 'response' | 'assumption';
  readonly author: 'agent' | 'human';
  readonly label: string;
  readonly enabled: boolean;
  readonly resolved: Record<string, unknown>;
}

export interface ProactivityGraphEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: string;
}

export interface ProactivityGraph {
  readonly nodes: readonly ProactivityGraphNode[];
  readonly edges: readonly ProactivityGraphEdge[];
}

export interface ProactivityReceipt {
  readonly receiptId: string;
  readonly action: string;
  readonly nodeId: string;
  readonly reversible: boolean;
}

/** Compiler output that remains review-only until its opaque compilation ID is
 * committed. This deliberately has no tenant, grant, effect contract, or raw
 * graph-patch field. */
export interface ProactivityCompilationCandidate {
  readonly kind: 'watch' | 'judgment' | 'response';
  readonly label: string;
  readonly condition?: string;
  readonly class?: string;
  readonly actionClass?: string;
}

export interface PendingProactivityCompilation {
  readonly id: string;
  readonly candidates: readonly ProactivityCompilationCandidate[];
}
