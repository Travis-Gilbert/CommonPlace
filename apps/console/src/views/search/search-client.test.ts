// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAMBDA } from '@commonplace/search-stack';
import {
  createConsoleSearchController,
  hydrateConsoleSearchPreference,
} from './search-client';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('console search controller ownership', () => {
  it('creates isolated state for each registered Search block', () => {
    const first = createConsoleSearchController();
    const second = createConsoleSearchController();

    first.setLambda(0.2);

    expect(first).not.toBe(second);
    expect(first.getSnapshot().lambda).toBe(0.2);
    expect(second.getSnapshot().lambda).toBe(DEFAULT_LAMBDA);
  });

  it('keeps the in-memory preference when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const controller = createConsoleSearchController();

    expect(() => controller.setLambda(0.2)).not.toThrow();
    expect(controller.getSnapshot().lambda).toBe(0.2);
  });

  it.each(['not-a-number', '-0.1', '1.1'])(
    'ignores an invalid persisted lambda of %s',
    (stored) => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(stored);
      const controller = createConsoleSearchController();

      hydrateConsoleSearchPreference(controller);

      expect(controller.getSnapshot().lambda).toBe(DEFAULT_LAMBDA);
    },
  );

  it('retries hydration after browser storage becomes available', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
      .mockImplementationOnce(() => {
        throw new Error('storage blocked');
      })
      .mockReturnValue('0.2');
    const controller = createConsoleSearchController();

    hydrateConsoleSearchPreference(controller);
    expect(controller.getSnapshot().lambda).toBe(DEFAULT_LAMBDA);

    hydrateConsoleSearchPreference(controller);
    expect(controller.getSnapshot().lambda).toBe(0.2);
    expect(getItem).toHaveBeenCalledTimes(2);
  });
});
