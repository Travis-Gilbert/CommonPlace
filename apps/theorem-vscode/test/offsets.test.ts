// SOURCING: none. Tests for local offset arithmetic.
/**
 * W2: UTF-8 byte offsets to UTF-16 code units, and the identity gate.
 *
 * These tests exist because the failure they guard is silent. A byte offset
 * rendered as a UTF-16 index on a file containing one accented letter puts the
 * squiggle under the wrong word, and nothing in the response says so. Every
 * assertion below would pass trivially on ASCII, which is why the fixture is
 * not ASCII.
 */

import { describe, expect, it } from 'vitest';
import {
  buildOffsetTable,
  byteToUtf16,
  resolveOffsets,
  toUtf16Span,
  utf16ToByte,
  utf8Length,
} from '@commonplace/block-view-contracts/editor-offsets';
import {
  FIXTURE_CONTENT_HASH,
  FIXTURE_DIAGNOSTICS,
  FIXTURE_SOURCE,
  FIXTURE_TOKENS,
} from '@commonplace/block-view-contracts/editor-intelligence-fixture';

const HASH = 'blake3:test';

/** Index into a fixture list, loudly. `noUncheckedIndexedAccess` is on. */
function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`fixture index ${index} is absent`);
  return value;
}

describe('utf8Length', () => {
  it('counts every UTF-8 width', () => {
    expect(utf8Length('a')).toBe(1);
    expect(utf8Length('Σ')).toBe(2);
    expect(utf8Length('é')).toBe(2);
    expect(utf8Length('—')).toBe(3);
    expect(utf8Length('価')).toBe(3);
    expect(utf8Length('😀')).toBe(4);
  });

  it('agrees with TextEncoder on the fixture', () => {
    expect(utf8Length(FIXTURE_SOURCE)).toBe(new TextEncoder().encode(FIXTURE_SOURCE).length);
  });
});

describe('byteToUtf16', () => {
  it('is the identity on ASCII, which is why ASCII fixtures prove nothing', () => {
    const table = buildOffsetTable('abcdef', HASH);
    for (let i = 0; i <= 6; i += 1) expect(byteToUtf16(table, i)).toBe(i);
  });

  it('diverges from the byte offset after a multi-byte character', () => {
    //  a(1)  Σ(2)  b(1)   ->  bytes 0,1,3 ; utf16 0,1,2
    const table = buildOffsetTable('aΣb', HASH);
    expect(table.byteLength).toBe(4);
    expect(table.utf16Length).toBe(3);
    expect(byteToUtf16(table, 0)).toBe(0);
    expect(byteToUtf16(table, 1)).toBe(1);
    expect(byteToUtf16(table, 3)).toBe(2);
    expect(byteToUtf16(table, 4)).toBe(3);
  });

  it('clamps an offset landing inside a character to that character start', () => {
    const table = buildOffsetTable('aΣb', HASH);
    // Byte 2 is the Σ continuation byte and addresses no UTF-16 index.
    expect(byteToUtf16(table, 2)).toBe(1);
  });

  it('clamps out-of-range offsets rather than returning NaN', () => {
    const table = buildOffsetTable('aΣb', HASH);
    expect(byteToUtf16(table, -5)).toBe(0);
    expect(byteToUtf16(table, 9_999)).toBe(3);
    expect(byteToUtf16(table, Number.NaN)).toBe(0);
  });

  it('handles astral characters, which occupy two UTF-16 units', () => {
    const table = buildOffsetTable('a😀b', HASH);
    expect(table.byteLength).toBe(6);
    expect(table.utf16Length).toBe(4);
    expect(byteToUtf16(table, 1)).toBe(1);
    expect(byteToUtf16(table, 5)).toBe(3);
    expect(utf16ToByte(table, 3)).toBe(5);
  });

  it('round-trips every UTF-16 index on the fixture', () => {
    const table = buildOffsetTable(FIXTURE_SOURCE, FIXTURE_CONTENT_HASH);
    for (let i = 0; i <= table.utf16Length; i += 1) {
      expect(byteToUtf16(table, utf16ToByte(table, i))).toBe(i);
    }
  });
});

describe('fixture spans land on the text they name', () => {
  const table = buildOffsetTable(FIXTURE_SOURCE, FIXTURE_CONTENT_HASH);

  function textOf(startByte: number, endByte: number): string {
    const { start, end } = toUtf16Span(table, startByte, endByte);
    return FIXTURE_SOURCE.slice(start, end);
  }

  it('resolves the exported function token', () => {
    const token = at(FIXTURE_TOKENS.tokens, 0);
    expect(textOf(token.startByte, token.endByte)).toBe('total');
  });

  it('resolves the accumulator token, which sits after the multibyte comment', () => {
    const token = at(FIXTURE_TOKENS.tokens, 1);
    expect(textOf(token.startByte, token.endByte)).toBe('sum');
    // The proof that conversion happened: the raw byte offset would land
    // elsewhere, because the comment line above contains 2- and 3-byte characters.
    expect(FIXTURE_SOURCE.slice(token.startByte, token.endByte)).not.toBe('sum');
  });

  it('resolves the trailing-whitespace finding', () => {
    const finding = at(FIXTURE_DIAGNOSTICS.diagnostics, 0);
    expect(finding.detector).toBe('text.trailing_whitespace');
    expect(textOf(finding.startByte, finding.endByte)).toBe('  ');
  });

  it('resolves the member expression the compute_code detector flagged', () => {
    const finding = at(FIXTURE_DIAGNOSTICS.diagnostics, 1);
    expect(textOf(finding.startByte, finding.endByte)).toBe('item.price');
  });

  it('normalizes a reversed span instead of producing a negative range', () => {
    const { start, end } = toUtf16Span(table, 40, 10);
    expect(start).toBeLessThanOrEqual(end);
  });
});

describe('resolveOffsets', () => {
  it('produces a table when the buffer matches the indexed bytes', () => {
    const resolved = resolveOffsets(FIXTURE_TOKENS, FIXTURE_SOURCE);
    expect(resolved.drift).toBeNull();
    expect(resolved.table?.contentHash).toBe(FIXTURE_CONTENT_HASH);
  });

  it('refuses when the payload carried no content to convert against', () => {
    const resolved = resolveOffsets({ contentHash: HASH }, FIXTURE_SOURCE);
    expect(resolved.table).toBeNull();
    expect(resolved.drift?.kind).toBe('content_absent');
  });

  it('refuses when the buffer diverged by a single byte', () => {
    // One inserted character is enough to move every offset after it. This is
    // the case that renders wrong and silently without the gate.
    const dirty = FIXTURE_SOURCE.replace('let sum', 'let  sum');
    const resolved = resolveOffsets(FIXTURE_TOKENS, dirty);
    expect(resolved.table).toBeNull();
    expect(resolved.drift).toMatchObject({
      kind: 'buffer_diverged',
      contentHash: FIXTURE_CONTENT_HASH,
    });
  });

  it('refuses on a change that leaves the length identical', () => {
    const swapped = FIXTURE_SOURCE.replace('let sum = 0;', 'let sum = 1;');
    expect(swapped.length).toBe(FIXTURE_SOURCE.length);
    expect(resolveOffsets(FIXTURE_TOKENS, swapped).table).toBeNull();
  });
});
