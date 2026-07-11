// TW2 record-table filtering. FilterChips carry an operator (contains/eq/gt/lt/
// gte/lte); the table applies them as a pure pre-pass over the ObjectSet so the
// declared op is honored (tanstack's columnFilters only carry a value, not an
// op). Pure and fully testable.

import type { ObjectRef, JsonValue } from '@/lib/block-view/types';
import type { FilterChip } from './types';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isNaN(n) ? NaN : n;
}

function asText(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** True when a single field value satisfies one filter chip. */
export function matchesFilter(value: JsonValue | undefined, filter: FilterChip): boolean {
  const target = filter.value;
  switch (filter.op) {
    case 'contains':
      return asText(value).toLowerCase().includes(target.toLowerCase());
    case 'eq':
      return asText(value) === target;
    case 'gt':
    case 'lt':
    case 'gte':
    case 'lte': {
      const a = toNumber(value);
      const b = toNumber(target);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (filter.op === 'gt') return a > b;
      if (filter.op === 'lt') return a < b;
      if (filter.op === 'gte') return a >= b;
      return a <= b;
    }
    default:
      return true;
  }
}

/** Objects that satisfy every filter (AND). Empty filter set is a pass-through. */
export function applyFilters(
  objects: readonly ObjectRef[],
  filters: readonly FilterChip[],
): ObjectRef[] {
  if (!filters.length) return objects as ObjectRef[];
  return objects.filter((object) =>
    filters.every((filter) => matchesFilter(object.properties[filter.field], filter)),
  );
}
