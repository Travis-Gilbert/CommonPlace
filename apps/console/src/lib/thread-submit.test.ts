import { beforeEach, describe, expect, it } from 'vitest';
import { useShellStore } from './shell-store';
import { submitThreadText } from './thread-submit';

describe('thread submission', () => {
  beforeEach(() => {
    useShellStore.setState({ actionSheetOrigin: null });
  });

  it('routes runnable starters through the Composer action path', async () => {
    await submitThreadText('/do Plan the next action');
    expect(useShellStore.getState().actionSheetOrigin).toEqual({
      instruction: 'Plan the next action',
      chips: [],
    });
  });
});
