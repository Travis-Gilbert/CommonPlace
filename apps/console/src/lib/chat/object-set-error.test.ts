import { describe, expect, it } from 'vitest';
import {
  isObjectSetUnreachable,
  objectSetError,
  unreachableObjectSet,
  UNREACHABLE_NOTE,
} from './object-set-error';

describe('object-set-error', () => {
  it('treats error field as unreachable', () => {
    const set = unreachableObjectSet(['run']);
    expect(isObjectSetUnreachable(set)).toBe(true);
    expect(objectSetError(set)).toBe(UNREACHABLE_NOTE);
    expect(set.objects).toEqual([]);
  });

  it('does not treat a genuine empty set as unreachable', () => {
    const set = {
      objects: [],
      shape: { types: ['run'], fields: [], relations: [], axes: {}, cardinality: 'empty' as const },
      subscribe: () => () => {},
    };
    expect(isObjectSetUnreachable(set)).toBe(false);
  });
});
