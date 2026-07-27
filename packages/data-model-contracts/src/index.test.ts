import { describe, expect, it } from 'vitest';
import {
  emptyDeclaredModel,
  emptyObservedModel,
  formatCoverage,
  formatFieldType,
  isPinned,
  parseFieldType,
  type DeclaredModel,
  type ScopeRef,
} from './index';

const scope: ScopeRef = { kind: 'topic', topicId: 'topic-models', tenant: 'Travis-Gilbert' };

describe('data model contract helpers', () => {
  it('creates an honest empty observed model for the requested scope', () => {
    expect(emptyObservedModel(scope)).toEqual({
      scope,
      eventCount: 0,
      types: [],
      sources: [],
    });
  });

  it('finds observed keys in declared provenance', () => {
    const declared: DeclaredModel = {
      ...emptyDeclaredModel(scope),
      fields: [{
        id: 'field-title',
        objectTypeId: 'type-document',
        key: 'title',
        label: 'Title',
        fieldType: { kind: 'text' },
        required: false,
        provenance: { observedKey: 'document.title' },
      }],
    };

    expect(isPinned('document.title', declared)).toBe(true);
    expect(isPinned('document.author', declared)).toBe(false);
  });

  it('formats bounded coverage as a percentage', () => {
    expect(formatCoverage(0.734, 1)).toBe('73.4%');
    expect(formatCoverage(2)).toBe('100%');
    expect(formatCoverage(Number.NaN)).toBe('0%');
  });

  it('parses closed FieldType from string or tagged object', () => {
    expect(parseFieldType('lc_text')).toEqual({ kind: 'lc_text' });
    expect(parseFieldType({ kind: 'vector', dim: 384 })).toEqual({ kind: 'vector', dim: 384 });
    expect(formatFieldType({ kind: 'relation', targetObjectTypeId: 't', cardinality: 'many' }))
      .toBe('relation(many:t)');
  });
});
