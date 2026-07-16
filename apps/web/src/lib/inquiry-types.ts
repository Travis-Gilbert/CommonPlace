// SOURCING: none — pure logic, no upstream component applies
/** Shared inquiry layer types (Theorem-backed Stateful Inquiry Layer). */

export type InquirySurface =
  | 'index'
  | 'research'
  | 'project'
  | 'object'
  | 'compose'
  | 'chat'
  | 'agent';

export type RetrievalBudget = 'quick' | 'standard' | 'research';

export type RetrievalStatus = 'running' | 'ready' | 'degraded' | 'failed';

export type EffectiveWebPolicy =
  | 'enabled'
  | 'disabled_by_user'
  | 'disabled_by_administrator';

export type ResultLaneKind =
  | 'top_evidence'
  | 'current_web'
  | 'connected_to_your_work'
  | 'recent_or_changed'
  | 'contradictory_or_novel'
  | 'related_objects';

export type EvidenceSourceKind =
  | 'web_result'
  | 'web_page'
  | 'extracted_passage'
  | 'graph_object'
  | 'memory'
  | 'file'
  | 'research_artifact'
  | 'federated_evidence';

export type EvidenceLifecycle =
  | 'ephemeral'
  | 'pinned'
  | 'cited'
  | 'promoted'
  | 'superseded'
  | 'expired';

export interface EvidenceArtifact {
  artifact_id: string;
  source_kind: EvidenceSourceKind;
  title: string;
  canonical_uri?: string | null;
  snippet: string;
  content_hash: string;
  published_at?: string | null;
  updated_at?: string | null;
  retrieved_at: string;
  object_refs: string[];
  final_score: number;
  lifecycle: EvidenceLifecycle | string;
  provenance: {
    provider_id: string;
    source_uri?: string | null;
  };
}

export interface ResultLane {
  kind: ResultLaneKind;
  artifact_ids: string[];
}

export interface InquirySnapshot {
  snapshot_id: string;
  thread_id: string;
  parent_snapshot_id?: string | null;
  query: string;
  surface: InquirySurface;
  scope_refs: string[];
  effective_web_policy: EffectiveWebPolicy;
  evidence: EvidenceArtifact[];
  result_lanes: ResultLane[];
  retrieval_status: RetrievalStatus;
  degradation_reasons: string[];
  state_hash: string;
  created_at: string;
}

export interface CreateInquiryResponse {
  thread_id: string;
  inquiry_id: string;
  status: string;
  events_url: string;
  snapshot: InquirySnapshot;
  head_invocation_count: number;
  public_queries_sent: number;
  events?: unknown[];
}

export interface GetInquiryResponse {
  inquiry_id: string;
  thread: {
    thread_id: string;
    tenant_id: string;
    owner_principal_id: string;
    title: string | null;
    active_snapshot_id: string | null;
    created_at: string;
    updated_at: string;
  };
  snapshot: InquirySnapshot;
}

export type InterpretationTarget =
  | { kind: 'head'; head_id: string }
  | { kind: 'best_available'; capability: string; domain?: string | null };

export interface InquiryInterpretation {
  interpretation_id: string;
  snapshot_id: string;
  target?: InterpretationTarget;
  answer_text: string;
  claims?: [string, string][];
  cited_artifact_ids: string[];
  invocation_receipt_id: string;
  created_at: string;
}

export interface InterpretInquiryResponse {
  interpretation: InquiryInterpretation;
  snapshot_hash: string;
  head_invocation_count: number;
}

export interface DelegateInquiryResponse {
  agent_run: {
    agent_run_id: string;
    input_snapshot_id: string;
    binding_id: string;
    harness_run_id?: unknown;
  };
  result: unknown;
  snapshot_hash: string;
  context_membrane_count?: number;
  grounded_claim_count?: number;
}

export const WEB_SEARCH_DISABLED_MESSAGE = 'Web search is disabled in Settings.';

export function resultLaneTitle(kind: ResultLaneKind): string {
  switch (kind) {
    case 'top_evidence':
      return 'Top evidence';
    case 'current_web':
      return 'Current web';
    case 'connected_to_your_work':
      return 'Connected to your work';
    case 'recent_or_changed':
      return 'Recent or changed';
    case 'contradictory_or_novel':
      return 'Contradictory or novel';
    case 'related_objects':
      return 'Related objects';
    default:
      return kind;
  }
}

export function collectDegradationNotices(snapshot: InquirySnapshot): string[] {
  const notices = [...snapshot.degradation_reasons];
  if (
    snapshot.effective_web_policy === 'disabled_by_user' ||
    snapshot.effective_web_policy === 'disabled_by_administrator'
  ) {
    if (!notices.some((n) => n.includes('Web search is disabled'))) {
      notices.unshift(WEB_SEARCH_DISABLED_MESSAGE);
    }
  }
  return notices;
}
