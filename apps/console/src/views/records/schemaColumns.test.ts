// SOURCING: none. Vitest for RT4 ViewMetadata parse + query mapping.

import { describe, expect, it } from 'vitest';
import {
  aggregateFiltersFromView,
  parseViewMetadata,
  predicatesFromViewFilters,
  rankersFromViewSorts,
} from './schemaColumns';

describe('parseViewMetadata', () => {
  it('parses filters, sorts, and columns instead of dropping them', () => {
    const view = parseViewMetadata({
      id: 'view-active',
      key: 'active-companies',
      label: 'Active companies',
      objectTypeId: 'Company',
      filters: [{ fieldKey: 'status', op: 'eq', value: 'active' }],
      sorts: [{ field_key: 'name', direction: 'asc' }],
      columns: [{ fieldKey: 'name', visible: true, order: 0 }],
    });
    expect(view).toBeTruthy();
    expect(view?.filters).toEqual([{ fieldKey: 'status', op: 'eq', value: 'active' }]);
    expect(view?.sorts).toEqual([{ fieldKey: 'name', direction: 'asc' }]);
    expect(view?.columns[0]?.fieldKey).toBe('name');
  });
});

describe('view query mapping', () => {
  it('maps eq/contains/empty filters onto ObjectQuery predicates', () => {
    expect(predicatesFromViewFilters([
      { fieldKey: 'status', op: 'eq', value: 'active' },
      { fieldKey: 'name', op: 'contains', value: 'acme' },
      { fieldKey: 'notes', op: 'is_empty' },
    ])).toEqual([
      { kind: 'eq', field: 'status', value: 'active' },
      { kind: 'contains', field: 'name', value: 'acme' },
      { kind: 'not', predicate: { kind: 'exists', field: 'notes' } },
    ]);
  });

  it('maps sorts onto field rankers', () => {
    expect(rankersFromViewSorts([{ fieldKey: 'updated', direction: 'desc' }])).toEqual([
      { kind: 'field', field: 'updated', direction: 'desc' },
    ]);
  });

  it('extracts equality filters for aggregate tool args', () => {
    expect(aggregateFiltersFromView([
      { fieldKey: 'status', op: 'eq', value: 'active' },
      { fieldKey: 'name', op: 'contains', value: 'x' },
    ])).toEqual({ status: 'active' });
  });
});
