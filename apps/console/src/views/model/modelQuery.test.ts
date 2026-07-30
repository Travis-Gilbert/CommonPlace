import { describe, expect, it } from 'vitest';
import {
  createModelQueryState,
  reduceModelQuery,
  type ModelQueryState,
} from './modelQuery';

describe('model query state', () => {
  it('preserves selection and pending pins while switching lenses', () => {
    const initial: ModelQueryState = {
      ...createModelQueryState({ kind: 'topic', topicId: 'topic-models' }),
      selection: { kind: 'observed-field', key: 'document.title' },
      pendingPins: ['document.title'],
    };

    const fields = reduceModelQuery(initial, { type: 'switch-lens', lens: 'fields' });
    const records = reduceModelQuery(fields, { type: 'switch-lens', lens: 'records' });

    expect(records.lens).toBe('records');
    expect(records.selection).toEqual(initial.selection);
    expect(records.pendingPins).toEqual(initial.pendingPins);
  });

  it('preserves state identity when React Flow repeats the same selection', () => {
    const initial = createModelQueryState({
      kind: 'topic',
      topicId: 'topic-models',
    });
    expect(reduceModelQuery(initial, {
      type: 'select',
      selection: null,
    })).toBe(initial);

    const selected = reduceModelQuery(initial, {
      type: 'select',
      selection: { kind: 'declared-type', key: 'orders' },
    });
    expect(reduceModelQuery(selected, {
      type: 'select',
      selection: { kind: 'declared-type', key: 'orders' },
    })).toBe(selected);
  });
});
