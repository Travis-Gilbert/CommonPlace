import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECALL_DIAL,
  isRecallSuppressed,
  recallBehavior,
  RECALL_POLICIES,
  resolveEffectivePolicy,
  type RecallPolicy,
} from '../recall-dial';

describe('recall dial default and positions', () => {
  it('defaults to Quiet (D7-1)', () => {
    expect(DEFAULT_RECALL_DIAL).toBe('quiet');
  });

  it('exposes the three positions in dial order', () => {
    expect(RECALL_POLICIES).toEqual<RecallPolicy[]>(['off', 'quiet', 'active']);
  });
});

describe('resolveEffectivePolicy', () => {
  it('lets the global dial apply when there is no per-site override', () => {
    expect(resolveEffectivePolicy(null, 'active')).toBe('active');
    expect(resolveEffectivePolicy(null, 'quiet')).toBe('quiet');
  });

  it('lets a per-site override win over the dial (mirrors resolve_effective)', () => {
    expect(resolveEffectivePolicy('quiet', 'active')).toBe('quiet');
    expect(resolveEffectivePolicy('active', 'off')).toBe('active');
  });

  it('keeps a site pinned Off suppressed no matter how loud the dial (D7-3)', () => {
    const effective = resolveEffectivePolicy('off', 'active');
    expect(effective).toBe('off');
    expect(isRecallSuppressed(effective)).toBe(true);
  });
});

describe('recallBehavior (D7-2)', () => {
  it('Off does not run the pipeline', () => {
    const behavior = recallBehavior('off');
    expect(behavior.run).toBe(false);
  });

  it('Quiet runs exact-tier-only, no proactive note', () => {
    const behavior = recallBehavior('quiet');
    expect(behavior.run).toBe(true);
    expect(behavior.mode).toBe('quiet');
    expect(behavior.exactOnly).toBe(true);
    expect(behavior.proactive).toBe(false);
  });

  it('Active runs both tiers with one proactive note', () => {
    const behavior = recallBehavior('active');
    expect(behavior.run).toBe(true);
    expect(behavior.mode).toBe('active');
    expect(behavior.exactOnly).toBe(false);
    expect(behavior.proactive).toBe(true);
  });

  it('observably differs between positions on a fixture page decision', () => {
    // The same page reaches the node under Active, is exact-only under Quiet, and
    // never reaches it under Off: each position changes behavior.
    const decisions = RECALL_POLICIES.map((policy) => recallBehavior(policy));
    expect(decisions.map((d) => d.run)).toEqual([false, true, true]);
    expect(decisions.map((d) => d.exactOnly)).toEqual([true, true, false]);
    expect(decisions.map((d) => d.proactive)).toEqual([false, false, true]);
  });
});
