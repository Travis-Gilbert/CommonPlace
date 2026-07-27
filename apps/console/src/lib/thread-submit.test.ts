import { beforeEach, describe, expect, it } from 'vitest';
import { useShellStore } from './shell-store';
import { actionInstructionFromThreadText, submitThreadText } from './thread-submit';

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

  it('recognizes only the runnable slash command boundary', () => {
    expect(actionInstructionFromThreadText('  /DO   Review the inbox  ')).toBe('Review the inbox');
    expect(actionInstructionFromThreadText('/document the decision')).toBeNull();
    expect(actionInstructionFromThreadText('explain /do')).toBeNull();
  });
});
