// SOURCING: none. Pure logic. CH9: empty objects with a transport error are
// unreachable, never an empty result.

import type { ObjectSet, ObjectShape, Unsubscribe } from '@commonplace/block-view/types';

export const UNREACHABLE_NOTE = 'console_data_api_unreachable';

export function objectSetError(set: ObjectSet): string | undefined {
  if (typeof set.error === 'string' && set.error.length > 0) return set.error;
  const note = set.notes?.find((value) => value === UNREACHABLE_NOTE || value.startsWith('unreachable:'));
  return note;
}

export function isObjectSetUnreachable(set: ObjectSet): boolean {
  return objectSetError(set) != null;
}

export function unreachableObjectSet(
  queryTypes: readonly string[],
  error: string = UNREACHABLE_NOTE,
  subscribe: (callback: (next: ObjectSet) => void) => Unsubscribe = () => () => {},
): ObjectSet {
  const shape: ObjectShape = {
    types: [...queryTypes],
    fields: [],
    relations: [],
    axes: {},
    cardinality: 'empty',
  };
  return {
    objects: [],
    shape,
    notes: [error],
    error,
    subscribe,
  };
}
