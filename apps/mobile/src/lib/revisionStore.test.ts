import { describe, expect, it, vi } from 'vitest';

import { createRevisionStore } from './revisionStore';

describe('revision store', () => {
  it('keeps snapshots stable until the backing store changes', () => {
    const store = createRevisionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    expect(store.getSnapshot()).toBe(store.getSnapshot());
    store.emit();
    expect(store.getSnapshot()).toBe(1);
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    store.emit();
    expect(store.getSnapshot()).toBe(2);
    expect(listener).toHaveBeenCalledOnce();
  });
});
