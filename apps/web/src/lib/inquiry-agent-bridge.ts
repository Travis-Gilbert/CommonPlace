// SOURCING: none — pure logic, no upstream component applies
/**
 * Bridge between Inquiry snapshots and the Theorem agent.
 *
 * Product language:
 * - Theorem = the one agent identity
 * - ACP = the live chat transport to Theorem (stdio protocol over WebSocket)
 * - Ask Theorem = the same agent, invoked after retrieval (Index opt-in; Chat implied)
 */

import type { EvidenceArtifact, InquirySnapshot } from '@/lib/inquiry-types';
import type { TheoremAgentClaim } from '@/lib/theorem-agent';

export function claimsFromInquirySnapshot(
  snapshot: InquirySnapshot,
  limit = 12,
): TheoremAgentClaim[] {
  return [...snapshot.evidence]
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, limit)
    .filter((artifact) => artifact.snippet.trim().length > 0 || artifact.title.trim().length > 0)
    .map((artifact) => ({
      text: claimText(artifact),
      provenance: artifact.canonical_uri || artifact.artifact_id,
    }));
}

export function groundedChatPrompt(
  userText: string,
  snapshot: InquirySnapshot,
): string {
  const lines = [...snapshot.evidence]
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, 8)
    .map((artifact, index) => {
      const source = artifact.canonical_uri || artifact.provenance.provider_id;
      return `${index + 1}. ${artifact.title}\n   ${artifact.snippet}\n   source: ${source}`;
    });

  const degradation =
    snapshot.degradation_reasons.length > 0
      ? `\nRetrieval notes: ${snapshot.degradation_reasons.join('; ')}`
      : '';

  return [
    'You are Theorem. Use the attached inquiry evidence (web + graph + memory) where it helps.',
    `Inquiry snapshot: ${snapshot.snapshot_id}`,
    `Evidence count: ${snapshot.evidence.length}${degradation}`,
    lines.length ? `Evidence:\n${lines.join('\n')}` : 'Evidence: none retrieved.',
    '',
    `User message:\n${userText}`,
  ].join('\n');
}

export function answerFromDelegateResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const root = result as Record<string, unknown>;
  const nested = (root.result && typeof root.result === 'object'
    ? (root.result as Record<string, unknown>)
    : root) as Record<string, unknown>;
  if (typeof nested.answer === 'string' && nested.answer.trim()) {
    return nested.answer.trim();
  }
  const claims = Array.isArray(nested.published_claims)
    ? nested.published_claims
    : Array.isArray(nested.claims)
      ? nested.claims
      : [];
  const texts = claims
    .map((claim) => {
      if (!claim || typeof claim !== 'object') return '';
      const text = (claim as { text?: unknown }).text;
      return typeof text === 'string' ? text.trim() : '';
    })
    .filter(Boolean);
  return texts.length ? texts.join('\n\n') : null;
}

function claimText(artifact: EvidenceArtifact): string {
  const parts = [artifact.title, artifact.snippet].filter((part) => part.trim().length > 0);
  return parts.join(': ');
}
