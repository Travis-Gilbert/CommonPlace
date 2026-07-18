import { describe, it, expect } from 'vitest';
import { holdReducer, IDLE_HOLD, KEEP_HOLD_MS, type HoldState } from '../hold';

const press = (nowMs: number) => ({ type: 'press' as const, nowMs });
const tick = (nowMs: number) => ({ type: 'tick' as const, nowMs });
const release = (nowMs: number) => ({ type: 'release' as const, nowMs });

describe('holdReducer', () => {
  it('press starts a hold at zero progress', () => {
    const { state, effect } = holdReducer(IDLE_HOLD, press(1000));
    expect(state).toEqual({ phase: 'holding', startMs: 1000, progress: 0 });
    expect(effect).toBeNull();
  });

  it('a mid-hold tick reports fractional progress and does not commit', () => {
    const held: HoldState = { phase: 'holding', startMs: 1000, progress: 0 };
    const { state, effect } = holdReducer(held, tick(1000 + KEEP_HOLD_MS / 2));
    expect(state.progress).toBeCloseTo(0.5, 5);
    expect(state.phase).toBe('holding');
    expect(effect).toBeNull();
  });

  it('the tick that fills the ring commits exactly once', () => {
    const held: HoldState = { phase: 'holding', startMs: 1000, progress: 0.9 };
    const filled = holdReducer(held, tick(1000 + KEEP_HOLD_MS));
    expect(filled.state.phase).toBe('complete');
    expect(filled.effect).toBe('commit');
    // A stray tick after completion must not commit again.
    const after = holdReducer(filled.state, tick(1000 + KEEP_HOLD_MS + 16));
    expect(after.effect).toBeNull();
  });

  it('releasing before the ring fills cancels and writes nothing', () => {
    const held: HoldState = { phase: 'holding', startMs: 1000, progress: 0.4 };
    const { state, effect } = holdReducer(held, release(1000 + KEEP_HOLD_MS / 3));
    expect(effect).toBe('cancel');
    expect(state).toEqual(IDLE_HOLD);
  });

  it('releasing after completion resets without a second write', () => {
    const complete: HoldState = { phase: 'complete', startMs: 1000, progress: 1 };
    const { state, effect } = holdReducer(complete, release(2000));
    expect(effect).toBeNull();
    expect(state).toEqual(IDLE_HOLD);
  });

  it('ticks outside a hold are no-ops', () => {
    const { state, effect } = holdReducer(IDLE_HOLD, tick(5000));
    expect(state).toBe(IDLE_HOLD);
    expect(effect).toBeNull();
  });

  it('progress never exceeds 1 even on a very late tick', () => {
    const held: HoldState = { phase: 'holding', startMs: 1000, progress: 0 };
    const { state } = holdReducer(held, tick(1000 + KEEP_HOLD_MS * 10));
    expect(state.progress).toBe(1);
  });
});
