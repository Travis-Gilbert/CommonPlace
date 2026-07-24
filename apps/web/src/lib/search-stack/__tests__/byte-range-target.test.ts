/**
 * The anchoring seam (SPEC F1): byte ranges from the find executor become the
 * quote-plus-context targets the in-page resolver understands.
 */

import { describe, expect, it } from 'vitest';
import {
  byteOffsetToCharOffset,
  byteRangeToTextTarget,
  sliceByteRange,
  utf8Length,
} from '../byte-range-target';
import { FIXTURE_PAGE_TEXT } from '../fixtures';

const BUDGET_RANGE = { start: 59, end: 65 };

describe('byteRangeToTextTarget', () => {
  it('round-trips: the quote is exactly the text the byte range names', () => {
    const target = byteRangeToTextTarget(
      { byteRange: BUDGET_RANGE, snippet: undefined },
      FIXTURE_PAGE_TEXT,
    );
    expect(target).not.toBeNull();
    expect(target?.quote).toBe(sliceByteRange(FIXTURE_PAGE_TEXT, BUDGET_RANGE));
    expect(target?.quote).toBe('budget');
  });

  it('takes prefix and suffix from the text around the quote', () => {
    const target = byteRangeToTextTarget(
      { byteRange: BUDGET_RANGE, snippet: undefined },
      FIXTURE_PAGE_TEXT,
    );
    expect(target?.prefix).toBeTruthy();
    expect(target?.suffix).toBeTruthy();
    // The context has to reconstruct the original text around the quote, which
    // is what lifts the resolver from 0.8 (quote only) to 1.0 confidence.
    expect(`${target?.prefix}${target?.quote}${target?.suffix}`).toContain('A budget is a promise');
    expect(FIXTURE_PAGE_TEXT).toContain(`${target?.prefix}${target?.quote}${target?.suffix}`);
  });

  it('sets a position hint so a repeated phrase resolves to the right occurrence', () => {
    const target = byteRangeToTextTarget(
      { byteRange: BUDGET_RANGE, snippet: undefined },
      FIXTURE_PAGE_TEXT,
    );
    expect(target?.positionHint).toBe(byteOffsetToCharOffset(FIXTURE_PAGE_TEXT, 59));
    expect(target?.positionHint).toBeGreaterThan(0);
  });

  it('locates the quote inside the snippet using the query, in the page casing', () => {
    const target = byteRangeToTextTarget(
      { byteRange: { start: 59, end: 65 }, snippet: 'threshold. A Budget is a promise about attention' },
      { query: 'budget' },
    );
    expect(target?.quote).toBe('Budget');
    expect(target?.prefix).toBe('threshold. A ');
    expect(target?.suffix).toBe(' is a promise about attention');
    expect(target?.positionHint).toBe(59);
  });

  it('anchors on the whole passage when no literal match exists to point at', () => {
    // Semantic and graph lanes match meaning, not characters, so a narrower
    // quote would be invented rather than derived.
    const target = byteRangeToTextTarget(
      { byteRange: { start: 4, end: 20 }, snippet: '  attention is finite  ' },
      { query: 'scarcity' },
    );
    expect(target?.quote).toBe('attention is finite');
    expect(target?.positionHint).toBe(4);
  });

  it('returns null rather than an empty quote that would match every text node', () => {
    expect(byteRangeToTextTarget({ byteRange: { start: 5, end: 5 }, snippet: undefined })).toBeNull();
    expect(byteRangeToTextTarget({ byteRange: { start: 0, end: 0 }, snippet: '   ' })).toBeNull();
    expect(
      byteRangeToTextTarget({ byteRange: { start: 0, end: 0 } }, { documentText: FIXTURE_PAGE_TEXT }),
    ).toBeNull();
  });

  it('measures multi-byte text in bytes, not characters', () => {
    const text = 'coût du budget';
    // "coût " is 6 bytes (the u-circumflex is two), so the next word starts there.
    expect(utf8Length('coût ')).toBe(6);
    const target = byteRangeToTextTarget({ byteRange: { start: 6, end: 8 }, snippet: undefined }, text);
    expect(target?.quote).toBe('du');
  });
});
