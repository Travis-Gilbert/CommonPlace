// SOURCING: none. Unit tests for Twenty presentation ↔ canonical FieldType.

import { describe, expect, it } from 'vitest';
import {
  EDITOR_TWENTY_FIELD_TYPES,
  fieldTypeFromEditor,
  fieldTypeToTwentyToken,
  parseTwentyFieldTypeToken,
  twentyTokenToFieldType,
  editorStateFromField,
  indexPolicyFromSettings,
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

  it('extracts index policy from settings', () => {
    expect(indexPolicyFromSettings(undefined)).toEqual({
      indexed: false,
      reverseIndexed: false,
      tokenized: false,
      indexOnly: false,
    });

    expect(
      indexPolicyFromSettings({
        isFilterable: true,
        isSortable: true,
        raw: {
          indexPolicy: {
            indexed: true,
            reverseIndexed: false,
            tokenized: true,
            indexOnly: false,
          },
        },
      })
    ).toEqual({
      indexed: true,
      reverseIndexed: false,
      tokenized: true,
      indexOnly: false,
    });
  });

  it('builds editor state from field preserving compound tokens like MULTI_SELECT', () => {
    const field = {
      id: 'test-field',
      universalIdentifier: 'uuid-1',
      type: 'MULTI_SELECT' as const,
      name: 'tags',
      label: 'Tags',
      isActive: true,
      isSystem: false,
      isUiEditable: true,
      isNullable: true,
      isUnique: false,
      options: [
        { id: '1', label: 'Tag 1', value: 'tag1', color: 'red', position: 1 },
        { id: '2', label: 'Tag 2', value: 'tag2', color: 'blue', position: 2 },
      ],
      settings: {
        isFilterable: true,
        isSortable: false,
        raw: {
          fieldType: { kind: 'json' },
        },
      },
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    const state = editorStateFromField(field);
    expect(state.token).toBe('MULTI_SELECT');
    expect(state.variants).toEqual(['tag1', 'tag2']);
  });
});