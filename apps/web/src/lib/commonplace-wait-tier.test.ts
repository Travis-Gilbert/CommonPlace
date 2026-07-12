import { describe, expect, it } from 'vitest';
import { tierForElapsed, WAIT_TIER_BOUNDS } from './commonplace-wait-tier';

// HANDOFF-WAIT-LADDER D1 acceptance: a simulated 15s operation walks T1, T2, T3
// at the boundaries, and a 200ms operation renders nothing (stays T0).
describe('tierForElapsed', () => {
  it('renders nothing under 300ms (a 200ms op stays T0)', () => {
    expect(tierForElapsed(0)).toBe('T0');
    expect(tierForElapsed(200)).toBe('T0');
    expect(tierForElapsed(WAIT_TIER_BOUNDS.t1 - 1)).toBe('T0');
  });

  it('promotes to T1 at 300ms', () => {
    expect(tierForElapsed(WAIT_TIER_BOUNDS.t1)).toBe('T1');
    expect(tierForElapsed(1000)).toBe('T1');
    expect(tierForElapsed(WAIT_TIER_BOUNDS.t2 - 1)).toBe('T1');
  });

  it('promotes to T2 at 2s', () => {
    expect(tierForElapsed(WAIT_TIER_BOUNDS.t2)).toBe('T2');
    expect(tierForElapsed(5000)).toBe('T2');
    expect(tierForElapsed(WAIT_TIER_BOUNDS.t3 - 1)).toBe('T2');
  });

  it('promotes to T3 beyond 10s (a 15s op is a job)', () => {
    expect(tierForElapsed(WAIT_TIER_BOUNDS.t3)).toBe('T3');
    expect(tierForElapsed(15000)).toBe('T3');
  });

  it('walks T0 to T3 in order across a 15s operation', () => {
    const walk = [0, 300, 2000, 10000, 15000].map(tierForElapsed);
    expect(walk).toEqual(['T0', 'T1', 'T2', 'T3', 'T3']);
  });
});
