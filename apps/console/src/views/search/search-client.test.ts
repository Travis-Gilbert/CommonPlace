import { describe, expect, it } from 'vitest';
import { DEFAULT_LAMBDA } from '@commonplace/search-stack';
import { createConsoleSearchController } from './search-client';

describe('console search controller ownership', () => {
  it('creates isolated state for each registered Search block', () => {
    const first = createConsoleSearchController();
    const second = createConsoleSearchController();

    first.setLambda(0.2);

    expect(first).not.toBe(second);
    expect(first.getSnapshot().lambda).toBe(0.2);
    expect(second.getSnapshot().lambda).toBe(DEFAULT_LAMBDA);
  });
});
