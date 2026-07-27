import { describe, expect, it } from 'vitest';
import { scrollPinFromMetrics, shouldAutoScroll } from './scroll-pin';

describe('scroll-pin', () => {
  it('stays pinned near the bottom while streaming', () => {
    const state = scrollPinFromMetrics({
      scrollTop: 950,
      clientHeight: 100,
      scrollHeight: 1050,
      streaming: true,
    });
    expect(state.pinned).toBe(true);
    expect(state.showReturn).toBe(false);
    expect(shouldAutoScroll(true, true)).toBe(true);
  });

  it('unpins when the user scrolls up and shows return', () => {
    const state = scrollPinFromMetrics({
      scrollTop: 100,
      clientHeight: 100,
      scrollHeight: 1050,
      streaming: true,
    });
    expect(state.pinned).toBe(false);
    expect(state.showReturn).toBe(true);
    expect(shouldAutoScroll(false, true)).toBe(false);
  });
});
