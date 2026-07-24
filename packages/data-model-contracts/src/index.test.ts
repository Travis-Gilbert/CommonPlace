import { describe, expect, it } from 'vitest';
import {
  emptyObservedModel,
  formatCoverage,
  isPinned,
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
      scope,
      objectTypes: [],
      fields: [{
        id: 'field-title',
        objectTypeId: 'type-document',
        key: 'title',
        label: 'Title',
        fieldType: 'string',
        provenance: { observedKey: 'document.title' },
      }],
      relations: [],
      views: [],
      versions: [],
    };

    expect(isPinned('document.title', declared)).toBe(true);
    expect(isPinned('document.author', declared)).toBe(false);
  });

  it('formats bounded coverage as a percentage', () => {
    expect(formatCoverage(0.734, 1)).toBe('73.4%');
    expect(formatCoverage(2)).toBe('100%');
    expect(formatCoverage(Number.NaN)).toBe('0%');
  });
});
