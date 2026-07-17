// SOURCING: none; pure ranking and cap logic, no upstream component applies.
//
// Highlight selection for the margin recall overlay (HANDOFF-MARGIN-RECALL D4/D7).
//
// The overlay never paints more than the page budget, ranks exact (DATAWAVE
// field_fact) connections ahead of semantic ones, and never highlights a target
// that re-anchored below confidence (that target is an orphan per D3, shown only in
// the collapsed session list, never on the wrong text). This is the pure decision
// the visual overlay applies after the salience pipeline returns; it is gate-exempt
// logic, unit tested here rather than eyeballed in the browser.

export type SalienceTier = 'exact' | 'semantic';

/** The fields highlight selection needs. The full candidate (D2) also carries its
 * anchor and explanation; selection only reads tier, score, and anchor confidence. */
export interface RankableCandidate {
  tier: SalienceTier;
  /** Connection strength in [0, 1] from the salience pipeline. */
  score: number;
  /** Anchor re-resolution confidence in [0, 1] (1 = exact text match). */
  confidence: number;
}

export interface SelectOptions {
  /** Max highlights painted on one page (the spec budget is 5). */
  budget: number;
  /** Targets that re-anchored below this are orphans: never highlighted. Default 0
   * keeps everything that resolved at all. */
  minConfidence?: number;
}

const TIER_RANK: Record<SalienceTier, number> = { exact: 0, semantic: 1 };

/**
 * Rank and cap candidates for painting: drop orphans (confidence below
 * minConfidence), order exact tier before semantic and then by descending score,
 * and keep at most budget. Stable within a (tier, score) group so equal candidates
 * keep their input order.
 */
export function selectHighlights<T extends RankableCandidate>(
  candidates: readonly T[],
  opts: SelectOptions,
): T[] {
  const minConfidence = opts.minConfidence ?? 0;
  const budget = Math.max(0, opts.budget);
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.confidence >= minConfidence)
    .sort((a, b) => {
      const byTier = TIER_RANK[a.candidate.tier] - TIER_RANK[b.candidate.tier];
      if (byTier !== 0) return byTier;
      if (b.candidate.score !== a.candidate.score) return b.candidate.score - a.candidate.score;
      return a.index - b.index; // stable tiebreak keeps input order within a group
    })
    .slice(0, budget)
    .map(({ candidate }) => candidate);
}
