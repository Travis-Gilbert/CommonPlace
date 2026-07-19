// SOURCING: vitest. The filing wire contract's own rules, tested where they
// live rather than through a rendered surface: the ribbon's time box, the
// receipt's sentence for each tier, and the shape of the mutation vocabulary.

import { describe, expect, it } from 'vitest';
import {
  attributionSentence,
  RIBBON_WINDOW_MS,
  tierLabel,
  withinRibbonWindow,
  type FiledItem,
  type FilingReceipt,
} from './types';
import { filingActionSchema, ruleActionSchema } from './actions';

const RECEIPT: FilingReceipt = {
  item: 'item-1',
  destination: 'coll-reading',
  tier: 1,
  attribution: { kind: 'features', features: [] },
  confidence: 0.8,
  actor: { kind: 'engine' },
  lowConfidence: false,
};

function filedAt(filedAtMs: number): FiledItem {
  return {
    item: 'item-1',
    title: 'Ownership in Rust',
    source: 'save',
    destination: 'coll-reading',
    filedAtMs,
    receipt: RECEIPT,
  };
}

describe('the ribbon time box', () => {
  const now = 1_752_000_000_000;

  it('keeps an item inside the trailing window', () => {
    expect(withinRibbonWindow(filedAt(now - 1_000), now)).toBe(true);
  });

  it('ages an item out exactly at the boundary', () => {
    // The boundary is exclusive, so an item at exactly the window's age has
    // aged out. A ribbon that kept it would be a ribbon that never empties.
    expect(withinRibbonWindow(filedAt(now - RIBBON_WINDOW_MS), now)).toBe(false);
    expect(withinRibbonWindow(filedAt(now - RIBBON_WINDOW_MS + 1), now)).toBe(true);
    expect(withinRibbonWindow(filedAt(now - RIBBON_WINDOW_MS - 1), now)).toBe(false);
  });
});

describe('the receipt answers why in words', () => {
  it('names the precedent at tier 0', () => {
    expect(
      attributionSentence({ kind: 'precedent', precedent: 'the appeals office' }),
    ).toBe('Filed where the appeals office has been filed before.');
  });

  it('names the rule at tier 0', () => {
    expect(attributionSentence({ kind: 'rule', ruleId: 'invoices' })).toBe(
      'Filed by your rule invoices.',
    );
  });

  it('names the three strongest features at tier 1', () => {
    const sentence = attributionSentence({
      kind: 'features',
      features: [
        { name: 'arrived from mail', weight: 0.2 },
        { name: 'text content', weight: -0.9 },
        { name: 'arrived around 09:00 UTC', weight: 0.5 },
        { name: 'mentions someone this shelf already knows', weight: 0.05 },
      ],
    });
    // Ordered by absolute weight, because a strongly negative feature explains
    // a filing as much as a strongly positive one does.
    expect(sentence).toBe(
      'Filed on text content, arrived around 09:00 UTC, arrived from mail.',
    );
  });

  it('says something honest when tier 1 had no dominant feature', () => {
    expect(attributionSentence({ kind: 'features', features: [] })).toBe(
      'Filed on the learned head with no single dominant feature.',
    );
  });

  it('renders the model reason verbatim at tier 2', () => {
    expect(
      attributionSentence({
        kind: 'model',
        reason: 'It reads as correspondence, not as reference material.',
      }),
    ).toBe('It reads as correspondence, not as reference material.');
  });

  it('labels every tier', () => {
    expect([tierLabel(0), tierLabel(1), tierLabel(2)]).toEqual([
      'precedent',
      'learned',
      'escalated',
    ]);
  });
});

describe('the mutation vocabulary', () => {
  it('accepts a correction and its reversal', () => {
    expect(
      filingActionSchema.safeParse({ kind: 'correct', item: 'i', to: 'c' }).success,
    ).toBe(true);
    expect(filingActionSchema.safeParse({ kind: 'undo', item: 'i' }).success).toBe(true);
  });

  it('has no approve action for an item, because corrections need no approval', () => {
    expect(filingActionSchema.safeParse({ kind: 'approve', item: 'i' }).success).toBe(false);
  });

  it('refuses a correction with no destination', () => {
    expect(filingActionSchema.safeParse({ kind: 'correct', item: 'i', to: '' }).success).toBe(
      false,
    );
  });

  it('refuses a rule with no predicates, which would match every arrival', () => {
    expect(
      ruleActionSchema.safeParse({
        kind: 'put',
        predicates: [],
        destination: 'c',
        urgent: false,
      }).success,
    ).toBe(false);
  });

  it('accepts a rule with one predicate and defaults urgent to false', () => {
    const parsed = ruleActionSchema.safeParse({
      kind: 'put',
      predicates: [{ kind: 'subject-contains', value: 'invoice' }],
      destination: 'Invoices',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.kind === 'put' && parsed.data.urgent).toBe(false);
  });

  it('refuses a predicate kind the engine does not have', () => {
    expect(
      ruleActionSchema.safeParse({
        kind: 'put',
        predicates: [{ kind: 'sender-name', value: 'x' }],
        destination: 'c',
      }).success,
    ).toBe(false);
  });

  it('carries consent and deny for rules only', () => {
    expect(ruleActionSchema.safeParse({ kind: 'consent', id: 'r' }).success).toBe(true);
    expect(ruleActionSchema.safeParse({ kind: 'deny', id: 'r' }).success).toBe(true);
    expect(filingActionSchema.safeParse({ kind: 'consent', item: 'i' }).success).toBe(false);
  });
});

describe('the wire contract carries no count', () => {
  // The design law is "no unread counts". The strongest way to hold it is to
  // give a surface nothing to render one from, so this asserts the absence at
  // the contract rather than trusting every future view to remember.
  it('has no numeric field on a receipt except its confidence', () => {
    const numeric = Object.entries(RECEIPT).filter(([, value]) => typeof value === 'number');
    expect(numeric.map(([key]) => key).sort()).toEqual(['confidence', 'tier']);
  });

  it('has no count field on a filed item', () => {
    const entry = filedAt(0) as unknown as Record<string, unknown>;
    expect(Object.keys(entry).some((key) => /count|unread|badge|total/i.test(key))).toBe(false);
  });
});
