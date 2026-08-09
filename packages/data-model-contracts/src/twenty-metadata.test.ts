// SOURCING: none. Unit tests for Twenty presentation ↔ canonical FieldType.

import { describe, expect, it } from 'vitest';
import {
  EDITOR_TWENTY_FIELD_TYPES,
  fieldTypeFromEditor,
  fieldTypeToTwentyToken,
  parseTwentyFieldTypeToken,
  twentyTokenToFieldType,
} from './twenty-metadata';

describe('twenty-metadata', () => {
  it('parses known Twenty tokens and falls back', () => {
    expect(parseTwentyFieldTypeToken('EMAILS')).toBe('EMAILS');
    expect(parseTwentyFieldTypeToken('nope')).toBe('TEXT');
  });

  it('round-trips editor tokens through canonical FieldType', () => {
    for (const token of EDITOR_TWENTY_FIELD_TYPES) {
      const canonical = twentyTokenToFieldType(token);
      const back = fieldTypeToTwentyToken(canonical);
      // Lossy compounds (EMAILS → text → TEXT) are allowed; assert stability.
      expect(typeof back).toBe('string');
      expect(twentyTokenToFieldType(back).kind).toBe(canonical.kind);
    }
  });

  it('maps boolean and uuid exactly', () => {
    expect(twentyTokenToFieldType('BOOLEAN')).toEqual({ kind: 'boolean' });
    expect(fieldTypeToTwentyToken({ kind: 'uuid' })).toBe('UUID');
  });

  it('builds tagged FieldType payloads for enum/vector/relation', () => {
    expect(
      fieldTypeFromEditor({
        token: 'SELECT',
        variants: ['open', 'closed'],
      }),
    ).toEqual({ kind: 'enum', variants: ['open', 'closed'] });
    expect(
      fieldTypeFromEditor({
        token: 'RAW_JSON',
        vectorDim: 384,
      }),
    ).toEqual({ kind: 'vector', dim: 384 });
    expect(
      fieldTypeFromEditor({
        token: 'RELATION',
        relationTarget: 'person',
        relationCardinality: 'one',
      }),
    ).toEqual({
      kind: 'relation',
      targetObjectTypeId: 'person',
      cardinality: 'one',
    });
  });
});