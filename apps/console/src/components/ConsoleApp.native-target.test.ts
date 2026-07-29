// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { openConsoleTarget } from './ConsoleApp';

describe('openConsoleTarget', () => {
  it('submits native Ask text to the shared conversation', async () => {
    const submit = vi.fn(async () => undefined);

    await openConsoleTarget(
      { kind: 'ask', query: 'What changed in this workspace?' },
      submit,
    );

    expect(submit).toHaveBeenCalledWith('What changed in this workspace?');
  });
});
