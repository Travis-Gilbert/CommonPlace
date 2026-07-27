import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/harness-ux', () => ({
  fetchStatus: vi.fn(async () => {
    throw new Error('harness down');
  }),
}));

import { ConsoleBlockHost } from './console-host';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import { isObjectSetUnreachable } from './chat/object-set-error';

describe('console-host CH9 unreachable', () => {
  it('does not return an empty set when automation history transport fails', async () => {
    const host = new ConsoleBlockHost(CONSOLE_VIEW_REGISTRY, {
      records: [],
    });
    const set = await Promise.resolve(host.query({ types: ['run'], live: false }));
    expect(isObjectSetUnreachable(set)).toBe(true);
    expect(set.objects).toEqual([]);
    expect(set.error).toBeTruthy();
  });
});
