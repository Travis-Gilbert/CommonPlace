import { describe, expect, it } from 'vitest';
import {
  byteOffsetToCharOffset,
  byteRangeToTextTarget,
  emphasizeSnippet,
  sliceByteRange,
  utf8Length,
} from './byte-range-target';

const TEXT =
  'The membrane admits results by budget, not by threshold. '
  + 'A budget is a promise about attention.';
const RANGE = { start: 59, end: 65 };

describe('byte range anchoring', () => {
  it('slices the exact indexed bytes', () => {
    expect(sliceByteRange(TEXT, RANGE)).toBe('budget');
  });

  it('carries context and a character position hint', () => {
    const target = byteRangeToTextTarget(
      { byteRange: RANGE },
      { documentText: TEXT },
    );
    expect(target?.quote).toBe('budget');
    expect(target?.prefix).toBeTruthy();
    expect(target?.suffix).toBeTruthy();
    expect(target?.positionHint).toBe(
      byteOffsetToCharOffset(TEXT, RANGE.start),
    );
  });

  it('preserves page casing when the query locates a snippet hit', () => {
    const target = byteRangeToTextTarget(
      {
        byteRange: RANGE,
        snippet: 'threshold. A Budget is a promise',
      },
      { query: 'budget' },
    );
    expect(target?.quote).toBe('Budget');
  });

  it('uses a semantic passage without inventing an exact match', () => {
    const target = byteRangeToTextTarget(
      {
        byteRange: { start: 4, end: 20 },
        snippet: '  attention is finite  ',
      },
      { query: 'scarcity' },
    );
    expect(target?.quote).toBe('attention is finite');
  });

  it('returns null for an empty target', () => {
    expect(
      byteRangeToTextTarget({
        byteRange: { start: 0, end: 0 },
      }),
    ).toBeNull();
  });

  it('counts multi-byte UTF-8 text', () => {
    expect(utf8Length('coût ')).toBe(6);
    expect(
      sliceByteRange('coût du budget', { start: 6, end: 8 }),
    ).toBe('du');
  });

  it('splits exact-hit emphasis through the same locator', () => {
    expect(
      emphasizeSnippet(
        {
          byteRange: RANGE,
          snippet: 'A Budget is a promise',
        },
        { query: 'budget' },
      ),
    ).toEqual({
      before: 'A ',
      match: 'Budget',
      after: ' is a promise',
    });
  });
});
