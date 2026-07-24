import { afterEach, describe, expect, it, vi } from 'vitest';
import { softNavigate } from './soft-navigate';

describe('softNavigate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('no-ops when the pathname already matches', async () => {
    vi.stubGlobal('window', {
      location: { pathname: '/workspace' },
    });
    const push = vi.fn();
    await softNavigate({ push }, '/workspace');
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes and resolves once the pathname catches up', async () => {
    vi.useFakeTimers();
    let pathname = '/chat';
    vi.stubGlobal('window', {
      get location() {
        return { pathname };
      },
    });
    const push = vi.fn(() => {
      setTimeout(() => {
        pathname = '/workspace';
      }, 120);
    });
    const pending = softNavigate({ push }, '/workspace/', { timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(200);
    await expect(pending).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledWith('/workspace/');
  });
});
