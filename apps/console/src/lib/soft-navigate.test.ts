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

  it('falls back to a hard navigation when a soft push is dropped', async () => {
    vi.useFakeTimers();
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { pathname: '/workspace', assign },
    });
    const push = vi.fn();
    const pending = softNavigate(
      { push },
      '/filing',
      { timeoutMs: 100, hardFallback: true },
    );
    await vi.advanceTimersByTimeAsync(150);
    await expect(pending).resolves.toBeUndefined();
    expect(push).toHaveBeenCalledWith('/filing');
    expect(assign).toHaveBeenCalledWith('/filing');
  });
});
