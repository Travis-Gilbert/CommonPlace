// SOURCING: none. The fixture standing structure. Verify-first V4 through V9
// found the kernel and aliveness engine ABSENT as built code in this checkout;
// per the spec's sequencing note the read model is built against fixtures now
// and lights up as the substrate lands behind the same block-view seam. This
// fixture is deliberately the spec's own five-minute test: a stake with four
// assumptions (one prunable), a bounded-label stake (frontier honesty), the
// four life sources, derived and authored watches, a human-authored trio
// compiled from "tell me when anyone I owe work to goes quiet", a response that
// could send an email but has no grant, a granted response, and an over-budget
// response.

import type {
  EffectContract,
  Grant,
  StandingBudget,
  StandingNode,
  StandingStructure,
} from './model';

/** The admitted fixture tenant. In production the block-view host carries the
 *  person's resolved tenant (theorem://{tenant}/...); here it is a fixture. */
export const FIXTURE_TENANT = 'fixture';

const NODES: readonly StandingNode[] = [
  // --- Stakes (the agent's handwriting: extracted from commitments) ---
  {
    id: 'pg-stake-appeal',
    kind: 'stake',
    statement: 'Get the insurance appeal resolved before the deadline',
    label: {
      assumptionIds: ['pg-assume-deadline', 'pg-assume-adjuster', 'pg-assume-claim', 'pg-assume-medical'],
      complete: true,
      prunedCount: 0,
    },
    author: 'agent',
    disabled: false,
  },
  {
    id: 'pg-stake-book',
    kind: 'stake',
    statement: 'Keep momentum on the manuscript',
    label: {
      // A bounded label: three assumptions surfaced, two pruned from the
      // frontier. It renders explored-frontier wording and never says "all".
      assumptionIds: ['pg-assume-editor', 'pg-assume-cadence', 'pg-assume-nodeadline'],
      complete: false,
      prunedCount: 2,
    },
    author: 'agent',
    disabled: false,
  },

  // --- Assumptions under the appeal stake (its four, one prunable) ---
  {
    id: 'pg-assume-deadline',
    kind: 'assumption',
    statement: 'The appeal deadline is the date on the denial letter',
    restsOn: 'the denial letter',
    couldChangeSourceIds: ['pg-source-email'],
    stakeId: 'pg-stake-appeal',
    pruned: false,
  },
  {
    id: 'pg-assume-adjuster',
    kind: 'assumption',
    statement: 'The same adjuster still handles this claim',
    restsOn: 'the last reply header',
    couldChangeSourceIds: ['pg-source-email'],
    stakeId: 'pg-stake-appeal',
    pruned: false,
  },
  {
    id: 'pg-assume-claim',
    kind: 'assumption',
    statement: 'Claim number 4471-B is the current one',
    restsOn: 'the policy record',
    couldChangeSourceIds: ['pg-source-email'],
    stakeId: 'pg-stake-appeal',
    pruned: false,
  },
  {
    id: 'pg-assume-medical',
    kind: 'assumption',
    statement: 'The medical records are already on file',
    restsOn: 'a note from the provider portal',
    couldChangeSourceIds: ['pg-source-email', 'pg-source-event'],
    stakeId: 'pg-stake-appeal',
    pruned: false,
  },

  // --- Assumptions under the manuscript stake ---
  {
    id: 'pg-assume-editor',
    kind: 'assumption',
    statement: 'The editor is waiting on chapter 7',
    restsOn: 'the last editor email',
    couldChangeSourceIds: ['pg-source-email'],
    stakeId: 'pg-stake-book',
    pruned: false,
  },
  {
    id: 'pg-assume-cadence',
    kind: 'assumption',
    statement: 'A weekly cadence keeps it alive',
    restsOn: 'the recurring calendar block',
    couldChangeSourceIds: ['pg-source-event'],
    stakeId: 'pg-stake-book',
    pruned: false,
  },
  {
    id: 'pg-assume-nodeadline',
    kind: 'assumption',
    statement: 'There is no hard external deadline yet',
    restsOn: 'the contract',
    couldChangeSourceIds: ['pg-source-email'],
    stakeId: 'pg-stake-book',
    pruned: false,
  },

  // --- Sources (the four life sources) ---
  { id: 'pg-source-email', kind: 'source', lifeKind: 'life_email', label: 'Email', ingest: 'live', disabled: false },
  { id: 'pg-source-event', kind: 'source', lifeKind: 'life_event', label: 'Calendar', ingest: 'live', disabled: false },
  { id: 'pg-source-sms', kind: 'source', lifeKind: 'life_sms', label: 'Messages', ingest: 'live', disabled: false },
  { id: 'pg-source-call', kind: 'source', lifeKind: 'life_call', label: 'Calls', ingest: 'live', disabled: false },

  // --- Watches (derived from labels, and authored standing queries) ---
  {
    id: 'pg-watch-appeal',
    kind: 'watch',
    subKind: 'derived',
    statement: 'The adjuster replies on the appeal',
    condition: 'a message from the adjuster arrives',
    conditionParams: {},
    sourceIds: ['pg-source-email'],
    stakeId: 'pg-stake-appeal',
    author: 'agent',
    disabled: false,
  },
  {
    id: 'pg-watch-book',
    kind: 'watch',
    subKind: 'derived',
    statement: 'The editor pings about the manuscript',
    condition: 'the editor emails or texts',
    conditionParams: {},
    sourceIds: ['pg-source-email', 'pg-source-sms'],
    stakeId: 'pg-stake-book',
    author: 'agent',
    disabled: false,
  },
  {
    // The five-minute test's authored watch, compiled last week from
    // "tell me when anyone I owe work to goes quiet". author: human.
    id: 'pg-watch-owe',
    kind: 'watch',
    subKind: 'authored',
    statement: 'Anyone I owe work to goes quiet',
    condition: 'someone I owe work to has not replied in {quietDays} days',
    conditionParams: { quietDays: 3 },
    sourceIds: ['pg-source-email', 'pg-source-sms'],
    queryFamily: 'open_loops',
    author: 'human',
    disabled: false,
  },
  {
    // The subscription quest: an authored watch that protects no stake.
    id: 'pg-watch-subs',
    kind: 'watch',
    subKind: 'authored',
    statement: 'A subscription renews or changes price',
    condition: 'a recurring charge over {amount} appears',
    conditionParams: { amount: 20 },
    sourceIds: ['pg-source-email'],
    queryFamily: 'recurring_charges',
    author: 'agent',
    disabled: false,
  },

  // --- Judgments (when it bothers you) ---
  { id: 'pg-judg-appeal', kind: 'judgment', judgmentClass: 'interrupt', thresholds: {}, watchId: 'pg-watch-appeal', author: 'agent', disabled: false },
  { id: 'pg-judg-book', kind: 'judgment', judgmentClass: 'digest', thresholds: {}, watchId: 'pg-watch-book', author: 'agent', disabled: false },
  { id: 'pg-judg-owe', kind: 'judgment', judgmentClass: 'digest', thresholds: { quietDays: 3 }, watchId: 'pg-watch-owe', author: 'human', disabled: false },
  { id: 'pg-judg-subs', kind: 'judgment', judgmentClass: 'digest', thresholds: { amount: 20 }, watchId: 'pg-watch-subs', author: 'agent', disabled: false },

  // --- Responses (what it does; each resolves an EffectContract + Grant) ---
  { id: 'pg-resp-appeal', kind: 'response', actionClass: 'send_email_reply', judgmentId: 'pg-judg-appeal', author: 'agent', disabled: false },
  { id: 'pg-resp-book', kind: 'response', actionClass: 'notify_digest', judgmentId: 'pg-judg-book', author: 'agent', disabled: false },
  { id: 'pg-resp-owe', kind: 'response', actionClass: 'draft_nudge', judgmentId: 'pg-judg-owe', author: 'human', disabled: false },
  { id: 'pg-resp-subs', kind: 'response', actionClass: 'push_subscription_alert', judgmentId: 'pg-judg-subs', author: 'agent', disabled: false },
];

/** EffectContracts owned by code (kernel AK2). An action class resolves here;
 *  the surface reads these and never writes them (grant boundary). */
const EFFECT_CONTRACTS: readonly EffectContract[] = [
  {
    id: 'ec-send-email',
    actionClass: 'send_email_reply',
    title: 'Send an email reply',
    summary: 'Sends a reply to the adjuster from your account.',
    reversible: false,
    capabilityClass: 'send:email',
    perFiringSpend: 1,
  },
  {
    id: 'ec-notify-digest',
    actionClass: 'notify_digest',
    title: 'Add to your daily digest',
    summary: 'Adds one item to the once-a-day digest.',
    reversible: true,
    capabilityClass: 'notify:digest',
    perFiringSpend: 1,
  },
  {
    id: 'ec-draft-nudge',
    actionClass: 'draft_nudge',
    title: 'Draft a nudge',
    summary: 'Prepares a short nudge for you to send.',
    reversible: true,
    capabilityClass: 'compose:nudge',
    perFiringSpend: 1,
  },
  {
    id: 'ec-push-subs',
    actionClass: 'push_subscription_alert',
    title: 'Push a subscription alert',
    summary: 'Sends a push when a subscription renews or changes price.',
    reversible: true,
    capabilityClass: 'notify:push',
    perFiringSpend: 8,
  },
];

/** Signed grants (kernel AK6/AK7). Present means the response may act on its
 *  own; absent means "will ask you every time". */
const GRANTS: readonly Grant[] = [
  { id: 'grant-digest', capabilityClass: 'notify:digest', grantedOn: '2026-06-30', revocable: true },
  // notify:push is granted but the response in that class is over budget, so it
  // still renders over-budget and does not run: the two boundaries are distinct.
  { id: 'grant-push', capabilityClass: 'notify:push', grantedOn: '2026-07-01', revocable: true, expiresOn: '2026-12-31' },
];

/** Standing budgets per capability class (verify-first V7). */
const BUDGETS: readonly StandingBudget[] = [
  { capabilityClass: 'send:email', cap: 20, committedSpend: 0 },
  { capabilityClass: 'notify:digest', cap: 50, committedSpend: 2 },
  { capabilityClass: 'compose:nudge', cap: 20, committedSpend: 0 },
  // The push class is nearly spent; one more per-firing spend of 8 exceeds 10.
  { capabilityClass: 'notify:push', cap: 10, committedSpend: 5 },
];

/** A fresh, deep copy of the fixture standing structure (the store mutates it,
 *  so every construction gets its own). */
export function seedStandingStructure(): StandingStructure {
  return structuredClone({
    nodes: NODES,
    effectContracts: EFFECT_CONTRACTS,
    grants: GRANTS,
    budgets: BUDGETS,
  });
}
