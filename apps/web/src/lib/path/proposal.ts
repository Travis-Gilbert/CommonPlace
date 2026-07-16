// SOURCING: none — pure logic, no upstream component applies
/**
 * PL4 Path proposal: draft → reviewable diff → apply (graph-version commit) → scrub rollback.
 * No new persistence: programmable_graph + rustyred_thg_graph_version_*.
 */

export interface ProposedNode {
  readonly id: string;
  readonly label?: string;
  readonly type?: string;
}

export interface ProposedEdge {
  readonly source: string;
  readonly target: string;
  readonly kind?: string;
}

export interface PathProposalDraft {
  readonly title: string;
  readonly nodes: readonly ProposedNode[];
  readonly edges: readonly ProposedEdge[];
  /** Optional typed program payload for programmable_graph. */
  readonly program?: Record<string, unknown>;
}

export interface PathProposalDiff {
  readonly addedNodes: readonly ProposedNode[];
  readonly removedNodes: readonly ProposedNode[];
  readonly addedEdges: readonly ProposedEdge[];
  readonly removedEdges: readonly ProposedEdge[];
  readonly existingNodeIds: readonly string[];
  readonly proposedNodeIds: readonly string[];
}

export interface PathProposalReview {
  readonly draft: PathProposalDraft;
  readonly diff: PathProposalDiff;
  /** Soft canvas projection from programmable_graph project, when available. */
  readonly projection?: Record<string, unknown>;
  readonly validated: boolean;
  readonly validationError?: string;
}

export interface PathProposalApplyResult {
  readonly commitId: string;
  readonly parentCommitId?: string;
  readonly message: string;
  readonly repository?: Record<string, unknown>;
  readonly appliedAt: string;
}

export interface PathProposalClients {
  validateOrProject(draft: PathProposalDraft): Promise<{
    ok: boolean;
    projection?: Record<string, unknown>;
    error?: string;
  }>;
  applyProgram(draft: PathProposalDraft): Promise<{ ok: boolean; error?: string }>;
  compileVersion(input: {
    message: string;
    author?: string;
    parentCommits?: string[];
  }): Promise<{ commitId: string; repository?: Record<string, unknown> }>;
  checkoutVersion(input: {
    repository: Record<string, unknown>;
    target: string;
  }): Promise<{ ok: boolean; snapshot?: Record<string, unknown>; error?: string }>;
  versionLog(repository: Record<string, unknown>): Promise<readonly string[]>;
}

export function buildProposalDiff(
  draft: PathProposalDraft,
  existingNodeIds: readonly string[],
  existingEdges: readonly ProposedEdge[] = [],
): PathProposalDiff {
  const existing = new Set(existingNodeIds);
  const proposed = new Set(draft.nodes.map((n) => n.id));
  const existingEdgeKeys = new Set(
    existingEdges.map((e) => `${e.source}|${e.target}|${e.kind ?? ''}`),
  );
  const proposedEdgeKeys = new Set(
    draft.edges.map((e) => `${e.source}|${e.target}|${e.kind ?? ''}`),
  );

  return {
    addedNodes: draft.nodes.filter((n) => !existing.has(n.id)),
    removedNodes: existingNodeIds
      .filter((id) => !proposed.has(id))
      .map((id) => ({ id })),
    addedEdges: draft.edges.filter(
      (e) => !existingEdgeKeys.has(`${e.source}|${e.target}|${e.kind ?? ''}`),
    ),
    removedEdges: existingEdges.filter(
      (e) => !proposedEdgeKeys.has(`${e.source}|${e.target}|${e.kind ?? ''}`),
    ),
    existingNodeIds: [...existing],
    proposedNodeIds: [...proposed],
  };
}

/**
 * Draft a reviewable DAG proposal without writing.
 * Acceptance: renders as diff before any write.
 */
export async function draftPathProposal(
  draft: PathProposalDraft,
  existingNodeIds: readonly string[],
  clients: PathProposalClients,
  existingEdges: readonly ProposedEdge[] = [],
): Promise<PathProposalReview> {
  const diff = buildProposalDiff(draft, existingNodeIds, existingEdges);
  const projected = await clients.validateOrProject(draft);
  return {
    draft,
    diff,
    projection: projected.projection,
    validated: projected.ok,
    validationError: projected.error,
  };
}

/**
 * Apply a reviewed proposal: materialize program, then compile graph-version commit.
 */
export async function applyPathProposal(
  review: PathProposalReview,
  clients: PathProposalClients,
  options: { message?: string; author?: string; parentCommits?: string[] } = {},
): Promise<PathProposalApplyResult> {
  if (!review.validated) {
    throw new Error(review.validationError || 'proposal failed validation');
  }
  const applied = await clients.applyProgram(review.draft);
  if (!applied.ok) {
    throw new Error(applied.error || 'programmable_graph_apply failed');
  }
  const message =
    options.message ??
    `path proposal: ${review.draft.title} (+${review.diff.addedNodes.length}/-${review.diff.removedNodes.length} nodes)`;
  const compiled = await clients.compileVersion({
    message,
    author: options.author ?? 'path-lens',
    parentCommits: options.parentCommits,
  });
  return {
    commitId: compiled.commitId,
    parentCommitId: options.parentCommits?.[0],
    message,
    repository: compiled.repository,
    appliedAt: new Date().toISOString(),
  };
}

/**
 * Scrub back to a prior graph-version commit (Timeline scrub analogue).
 */
export async function rollbackPathProposal(
  repository: Record<string, unknown>,
  targetCommit: string,
  clients: PathProposalClients,
): Promise<{ ok: boolean; snapshot?: Record<string, unknown> }> {
  const result = await clients.checkoutVersion({ repository, target: targetCommit });
  if (!result.ok) {
    throw new Error(result.error || `checkout ${targetCommit} failed`);
  }
  return { ok: true, snapshot: result.snapshot };
}

/** Signal ids for proposed nodes/edges (diff overlay on the Path lens). */
export function proposalSignalIds(diff: PathProposalDiff): {
  signalNodeIds: Set<string>;
  inkNodeIds: Set<string>;
} {
  const signalNodeIds = new Set(diff.addedNodes.map((n) => n.id));
  const inkNodeIds = new Set(diff.existingNodeIds);
  for (const id of diff.proposedNodeIds) {
    if (!signalNodeIds.has(id)) inkNodeIds.add(id);
  }
  return { signalNodeIds, inkNodeIds };
}
