// SOURCING: none; pure test logic (vitest), no upstream component applies.
//
// Proves D4's selection acceptance: the budget cap holds on twenty candidates,
// exact tier ranks first, and sub-confidence targets (orphans, D3) never highlight.

import { describe, it, expect } from 'vitest';
import { selectHighlights, type RankableCandidate } from '../select';

function cand(tier: 'exact' | 'semantic', score: number, confidence = 1): RankableCandidate {
  return { tier, score, confidence };
}

describe('selectHighlights', () => {
  it('caps at the page budget (20 candidates, budget 5)', () => {
    const many = Array.from({ length: 20 }, (_, i) => cand('semantic', i / 20));
    expect(selectHighlights(many, { budget: 5 })).toHaveLength(5);
  });

  it('ranks exact tier ahead of semantic even at a lower score', () => {
    const mixed = [cand('semantic', 0.99), cand('exact', 0.1)];
    expect(selectHighlights(mixed, { budget: 5 })[0].tier).toBe('exact');
  });

  it('orders by descending score within a tier', () => {
    const out = selectHighlights([cand('exact', 0.3), cand('exact', 0.9), cand('exact', 0.6)], {
      budget: 5,
    });
    expect(out.map((c) => c.score)).toEqual([0.9, 0.6, 0.3]);
  });

  it('is stable for equal (tier, score) candidates', () => {
    const a = cand('exact', 0.5);
    const b = cand('exact', 0.5);
    const out = selectHighlights([a, b], { budget: 5 });
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
  });

  it('drops orphans below minConfidence: they are never highlighted', () => {
    const out = selectHighlights([cand('exact', 1, 0.2), cand('exact', 0.5, 0.9)], {
      budget: 5,
      minConfidence: 0.5,
    });
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe(0.9);
  });
});
