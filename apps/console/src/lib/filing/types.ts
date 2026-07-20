// SOURCING: none. Pure wire contract for SPEC-COMMONPLACE-FILING-AND-INDEX-1.0,
// the TypeScript mirror of the rustyred-thg-filing envelope. It carries no
// credential, no tenant input, and no server-only import, so client views
// consume it without crossing the harness boundary (the shape
// src/lib/proactivity/types.ts established).
//
// Two absences here are load-bearing, not oversights:
//   1. No count field on any type. The Index renders no badges and no
//      counters, so no count crosses the wire to be tempted into one.
//   2. No "pending" or "unsorted" state. The arrival state is sorted; every
//      item has a destination the moment it exists in the store.

/** The six arrival sources the filing engine adapts (spec B1). */
export type FilingSource =
  | 'save'
  | 'mail'
  | 'watched-file'
  | 'notification'
  | 'dispatch-result'
  | 'agent-output';

/** Which tier decided a filing (spec B2, B3, B4). */
export type FilingTier = 0 | 1 | 2;

/** Who acted. Tier 1 weights human corrections above agent corrections, so the
 *  distinction is carried on every receipt and every correction event. */
export interface FilingActor {
  readonly kind: 'human' | 'agent' | 'engine';
  /** Agent or account identifier when one exists. */
  readonly id?: string;
}

export interface FilingFeatureWeight {
  readonly name: string;
  readonly weight: number;
}

/**
 * Why this item is where it is. One variant per tier: tier 0 names the
 * precedent or rule, tier 1 names the features that moved the score, tier 2
 * carries the model's one-line reason.
 */
export type FilingAttribution =
  | { readonly kind: 'precedent'; readonly precedent: string }
  | { readonly kind: 'rule'; readonly ruleId: string }
  | { readonly kind: 'features'; readonly features: readonly FilingFeatureWeight[] }
  | { readonly kind: 'model'; readonly reason: string };

export interface FilingReceipt {
  readonly item: string;
  /** Where this receipt put the item. Carried on the receipt itself, so the
   *  correction affordance can show the current shelf without a second read. */
  readonly destination: string;
  readonly tier: FilingTier;
  readonly attribution: FilingAttribution;
  /** Calibrated, 0 to 1. */
  readonly confidence: number;
  readonly actor: FilingActor;
  /** Set when tier 2 was warranted but the budget was exhausted, so the item
   *  filed on the best tier-1 guess rather than blocking on arrival. */
  readonly lowConfidence: boolean;
}

/** A shelf. Deliberately has no item count: see the header note. */
export interface IndexCollection {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
}

export interface FiledItem {
  readonly item: string;
  readonly title: string;
  readonly source: FilingSource;
  readonly destination: string;
  readonly filedAtMs: number;
  readonly receipt: FilingReceipt;
}

export interface DigestGroup {
  readonly destination: IndexCollection;
  readonly items: readonly FiledItem[];
}

export type FilingPredicateKind =
  | 'sender-entity'
  | 'source'
  | 'path-prefix'
  | 'mime-class'
  | 'subject-contains';

export interface FilingPredicate {
  readonly kind: FilingPredicateKind;
  readonly value: string;
}

/** An agent may propose a rule; a proposal contributes nothing until a person
 *  consents. Corrections need no approval, but standing rules do, because a
 *  rule is a decision that keeps acting after the moment it was made. */
export type FilingRuleState = 'active' | 'pending-consent';

export interface FilingRule {
  readonly id: string;
  readonly predicates: readonly FilingPredicate[];
  readonly destination: string;
  readonly urgent: boolean;
  readonly state: FilingRuleState;
  readonly proposedBy?: FilingActor;
  /** The proposal's stated reason, rendered in the pending-consent row. */
  readonly reason?: string;
  /** Present only when every predicate is mail-scoped, so the rule compiles
   *  to Sieve and keeps sorting while the app is closed. */
  readonly sievePreview?: string;
}

export interface UrgentEvent {
  readonly id: string;
  readonly item: string;
  readonly title: string;
  readonly reason: string;
  readonly atMs: number;
  readonly receipt: FilingReceipt;
}

/** The one-line law, rendered once on first use of the receipt affordance so
 *  people learn that the cost of a wrong file is near zero. */
export const FILING_LAW = 'Filing is presentation; Find always works.';

/** The trailing window the recently-filed ribbon covers. The ribbon exists to
 *  make corrections effortless; it is not a queue, so it empties itself. */
export const RIBBON_WINDOW_MS = 24 * 60 * 60 * 1000;

export function tierLabel(tier: FilingTier): string {
  switch (tier) {
    case 0:
      return 'precedent';
    case 1:
      return 'learned';
    case 2:
      return 'escalated';
  }
}

export function attributionSentence(attribution: FilingAttribution): string {
  switch (attribution.kind) {
    case 'precedent':
      return `Filed where ${attribution.precedent} has been filed before.`;
    case 'rule':
      return `Filed by your rule ${attribution.ruleId}.`;
    case 'features': {
      const top = [...attribution.features]
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
        .slice(0, 3)
        .map((feature) => feature.name);
      return top.length > 0
        ? `Filed on ${top.join(', ')}.`
        : 'Filed on the learned head with no single dominant feature.';
    }
    case 'model':
      return attribution.reason;
  }
}

/** Items outside the trailing window have aged out of the ribbon. */
export function withinRibbonWindow(item: FiledItem, nowMs: number): boolean {
  return nowMs - item.filedAtMs < RIBBON_WINDOW_MS;
}
