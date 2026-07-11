import { describe, it, expect } from 'vitest';
import type { ObjectRef } from '@/lib/block-view/types';
import type { FilterChip } from './types';
import { applyFilters, matchesFilter } from './record-filter';

const rows: ObjectRef[] = [
  { id: '1', type: 'task', properties: { id: '1', title: 'Alpha', status: 'open', count: 3 } },
  { id: '2', type: 'task', properties: { id: '2', title: 'Beta', status: 'done', count: 12 } },
  { id: '3', type: 'task', properties: { id: '3', title: 'Gamma', status: 'open', count: 7 } },
];

const chip = (over: Partial<FilterChip>): FilterChip => ({
  id: 'f',
  field: 'title',
  op: 'contains',
  value: '',
  ...over,
});

describe('record-filter', () => {
  it('contains is case-insensitive substring', () => {
    expect(matchesFilter('Alpha', chip({ value: 'lph' }))).toBe(true);
    expect(matchesFilter('Alpha', chip({ value: 'zzz' }))).toBe(false);
  });

  it('eq is exact string equality', () => {
    expect(matchesFilter('open', chip({ op: 'eq', value: 'open' }))).toBe(true);
    expect(matchesFilter('open', chip({ op: 'eq', value: 'Open' }))).toBe(false);
  });

  it('numeric comparisons parse both sides', () => {
    expect(matchesFilter(7, chip({ op: 'gt', value: '3' }))).toBe(true);
    expect(matchesFilter(7, chip({ op: 'lte', value: '7' }))).toBe(true);
    expect(matchesFilter('nope', chip({ op: 'gt', value: '3' }))).toBe(false);
  });

  it('applyFilters ANDs every chip', () => {
    const out = applyFilters(rows, [
      chip({ id: 'a', field: 'status', op: 'eq', value: 'open' }),
      chip({ id: 'b', field: 'count', op: 'gt', value: '5' }),
    ]);
    expect(out.map((r) => r.id)).toEqual(['3']);
  });

  it('empty filter set is a pass-through', () => {
    expect(applyFilters(rows, [])).toHaveLength(3);
  });
});
