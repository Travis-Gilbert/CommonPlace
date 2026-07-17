import { describe, expect, it } from 'vitest';
import {
  marginCandidatesFromWire,
  parseSalienceCandidate,
  parseSalienceCandidates,
  salienceCandidateId,
  salienceToMarginCandidate,
  type SalienceCandidate,
} from '../salience';

// A wire candidate exactly as the Rust `salience.rs` serde emits it (snake-free fields,
// lowercase tier, refs present). Fixtures live only in test files, per the no-fake-UI rule.
const EXACT_WIRE = {
  anchor: {
    quote: { exact: 'the Peloponnesian War', prefix: 'about ', suffix: ' reshaped' },
    position: { start: 40, end: 61 },
  },
  tier: 'exact',
  explanation: 'This passage names "Peloponnesian War", which is already in your library.',
  score: 1.0,
  refs: ['item:war'],
};

// A semantic candidate with the `refs` key omitted (the Rust side skips it when empty).
const SEMANTIC_WIRE = {
  anchor: {
    quote: { exact: 'marble sculpture athens acropolis' },
    position: { start: 4, end: 37 },
  },
  tier: 'semantic',
  explanation: 'Related to your note "Greek Art Notes" (similarity 0.81).',
  score: 0.81,
};

describe('parseSalienceCandidate', () => {
  it('decodes a full exact-tier wire candidate', () => {
    const candidate = parseSalienceCandidate(EXACT_WIRE);
    expect(candidate).not.toBeNull();
    expect(candidate?.tier).toBe('exact');
    expect(candidate?.anchor.quote.exact).toBe('the Peloponnesian War');
    expect(candidate?.anchor.quote.prefix).toBe('about ');
    expect(candidate?.anchor.position).toEqual({ start: 40, end: 61 });
    expect(candidate?.score).toBe(1.0);
    expect(candidate?.refs).toEqual(['item:war']);
  });

  it('defaults refs to [] when the wire omits it', () => {
    const candidate = parseSalienceCandidate(SEMANTIC_WIRE);
    expect(candidate?.refs).toEqual([]);
    expect(candidate?.anchor.quote.prefix).toBeUndefined();
  });

  it('returns null on shape mismatch instead of throwing', () => {
    expect(parseSalienceCandidate(null)).toBeNull();
    expect(parseSalienceCandidate({ anchor: {} })).toBeNull();
    // Bad tier.
    expect(
      parseSalienceCandidate({ ...EXACT_WIRE, tier: 'guess' }),
    ).toBeNull();
    // Missing position.
    expect(
      parseSalienceCandidate({
        anchor: { quote: { exact: 'x' } },
        tier: 'exact',
        explanation: 'e',
        score: 1,
      }),
    ).toBeNull();
    // Non-numeric score.
    expect(parseSalienceCandidate({ ...EXACT_WIRE, score: 'high' })).toBeNull();
  });
});

describe('parseSalienceCandidates', () => {
  it('drops malformed entries and keeps the valid ones', () => {
    const list = parseSalienceCandidates([EXACT_WIRE, { junk: true }, SEMANTIC_WIRE]);
    expect(list).toHaveLength(2);
    expect(list.map((candidate) => candidate.tier)).toEqual(['exact', 'semantic']);
  });

  it('returns [] for a non-array payload', () => {
    expect(parseSalienceCandidates(null)).toEqual([]);
    expect(parseSalienceCandidates({})).toEqual([]);
  });
});

describe('salienceToMarginCandidate', () => {
  it('projects the wire candidate to the overlay shape', () => {
    const candidate = parseSalienceCandidate(EXACT_WIRE) as SalienceCandidate;
    const margin = salienceToMarginCandidate(candidate);
    expect(margin.quote).toEqual(candidate.anchor.quote);
    // The position becomes the resolve hint.
    expect(margin.hint).toEqual(candidate.anchor.position);
    expect(margin.tier).toBe('exact');
    expect(margin.score).toBe(1.0);
    expect(margin.explanation).toContain('Peloponnesian War');
    // Id derives from the connected record plus the span.
    expect(margin.id).toBe('item:war:40-61');
  });

  it('derives a collision-free id when refs are empty', () => {
    const first = salienceToMarginCandidate(parseSalienceCandidate(SEMANTIC_WIRE) as SalienceCandidate);
    const secondWire = { ...SEMANTIC_WIRE, anchor: { ...SEMANTIC_WIRE.anchor, position: { start: 90, end: 120 } } };
    const second = salienceToMarginCandidate(parseSalienceCandidate(secondWire) as SalienceCandidate);
    expect(first.id).not.toBe(second.id);
    expect(salienceCandidateId(parseSalienceCandidate(SEMANTIC_WIRE) as SalienceCandidate)).toBe('salience:4-37');
  });
});

describe('marginCandidatesFromWire', () => {
  it('parses and adapts a raw payload end to end, dropping the bad record', () => {
    const margins = marginCandidatesFromWire([EXACT_WIRE, { nope: 1 }, SEMANTIC_WIRE]);
    expect(margins).toHaveLength(2);
    expect(margins[0].id).toBe('item:war:40-61');
    expect(margins[1].tier).toBe('semantic');
  });
});
