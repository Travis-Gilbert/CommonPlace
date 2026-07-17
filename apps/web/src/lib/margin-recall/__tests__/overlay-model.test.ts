import { describe, it, expect } from 'vitest';
import { placeHighlights, clipRect, type MarginCandidate, type QuoteResolver } from '../overlay-model';
import type { Rect } from '@commonplace/coannotate';

const RECT: Rect = { x: 10, y: 20, width: 100, height: 16 };

function cand(id: string, tier: 'exact' | 'semantic', score: number): MarginCandidate {
  return { id, quote: { exact: id }, tier, score, explanation: `why ${id}` };
}

/** A resolver driven by a table of id -> { rects, confidence }. */
function resolverFrom(table: Record<string, { rects: Rect[]; confidence: number }>): QuoteResolver {
  return (quote) => table[quote.exact] ?? { rects: [], confidence: 0 };
}

describe('placeHighlights', () => {
  it('caps at the budget (6 candidates, budget 5)', () => {
    const cands = Array.from({ length: 6 }, (_, i) => cand(`c${i}`, 'semantic', i / 6));
    const table = Object.fromEntries(cands.map((c) => [c.id, { rects: [RECT], confidence: 1 }]));
    const placed = placeHighlights(cands, resolverFrom(table), { budget: 5 });
    expect(placed).toHaveLength(5);
  });

  it('ranks exact tier ahead of a higher-scoring semantic one', () => {
    const cands = [cand('sem', 'semantic', 0.99), cand('exa', 'exact', 0.10)];
    const table = { sem: { rects: [RECT], confidence: 1 }, exa: { rects: [RECT], confidence: 1 } };
    const placed = placeHighlights(cands, resolverFrom(table), { budget: 5 });
    expect(placed[0].id).toBe('exa');
  });

  it('excludes orphans: a target below minConfidence is never painted', () => {
    const cands = [cand('solid', 'exact', 0.5), cand('orphan', 'exact', 0.9)];
    const table = {
      solid: { rects: [RECT], confidence: 0.9 },
      orphan: { rects: [RECT], confidence: 0.2 },
    };
    const placed = placeHighlights(cands, resolverFrom(table), { budget: 5, minConfidence: 0.5 });
    expect(placed.map((p) => p.id)).toEqual(['solid']);
  });

  it('drops candidates that resolve to no visible rects', () => {
    const cands = [cand('visible', 'exact', 0.5), cand('offscreen', 'exact', 0.9)];
    const table = {
      visible: { rects: [RECT], confidence: 1 },
      offscreen: { rects: [], confidence: 1 },
    };
    const placed = placeHighlights(cands, resolverFrom(table), { budget: 5 });
    expect(placed.map((p) => p.id)).toEqual(['visible']);
  });

  it('carries the candidate, tier, rects, and confidence through to the placement', () => {
    const cands = [cand('a', 'exact', 0.5)];
    const table = { a: { rects: [RECT, RECT], confidence: 0.8 } };
    const [placed] = placeHighlights(cands, resolverFrom(table), { budget: 5, minConfidence: 0 });
    expect(placed).toMatchObject({ id: 'a', tier: 'exact', confidence: 0.8 });
    expect(placed.rects).toHaveLength(2);
    expect(placed.candidate.explanation).toBe('why a');
  });
});

describe('clipRect', () => {
  const bounds: Rect = { x: 0, y: 0, width: 200, height: 100 };

  it('returns a fully-contained rect unchanged', () => {
    expect(clipRect({ x: 10, y: 10, width: 50, height: 20 }, bounds)).toEqual({ x: 10, y: 10, width: 50, height: 20 });
  });

  it('clamps a rect that overhangs the bounds', () => {
    expect(clipRect({ x: 180, y: 90, width: 50, height: 50 }, bounds)).toEqual({ x: 180, y: 90, width: 20, height: 10 });
  });

  it('returns null for a rect fully outside (scrolled past the content viewport)', () => {
    expect(clipRect({ x: 0, y: 200, width: 50, height: 20 }, bounds)).toBeNull();
  });

  it('returns null for a zero-overlap edge touch', () => {
    expect(clipRect({ x: 200, y: 0, width: 10, height: 10 }, bounds)).toBeNull();
  });
});
