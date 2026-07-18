// SOURCING: none. The typed vocabulary of the standing proactivity graph.
// This models the SPEC-AGENCY-PROPOSAL-KERNEL and SPEC-ALIVENESS-ENGINE
// contracts as the surface reads them, anchored to the kernel's specified
// field sets (Stake AK1, EffectContract AK2, Grant, the AE6 standing-query
// family, the ATMS label AK5.4, the exact-approval proposal fields) so this is
// the kernel's vocabulary projected, not a parallel model. Every object here is
// ABSENT as built code in this checkout (verify-first V4 through V9); the
// projection fills it from fixtures behind this stable interface and lights up
// unchanged when the kernel lands behind the same block-view seam.

/** The five authorable node kinds plus the one derived kind (the vocabulary). */
export type PgNodeKind = 'stake' | 'source' | 'watch' | 'judgment' | 'response' | 'assumption';

/** Who wrote a node. Human intent is compiled but otherwise indistinguishable
 *  (named choice 4). */
export type PgAuthor = 'agent' | 'human';

/** The five DataWave life sources (the spec's Source vocabulary). `life_clock`
 *  is time as a fact source, not a trigger (aliveness named choice 3): it emits
 *  temporal facts (a staleness threshold passed, a cadence tick) that feed a
 *  watch like any other source, so there is no cron block. */
export type LifeSourceKind = 'life_email' | 'life_event' | 'life_sms' | 'life_call' | 'life_clock';

/** A source's ingest state, rendered so disabling is never silent. */
export type IngestState = 'live' | 'paused' | 'error';

/** A watch is a standing program. Derived falls out of a stake's label;
 *  authored is a standing query protecting no particular stake. */
export type WatchSubKind = 'derived' | 'authored';

/** The AE6 standing-query family: the authored watches that protect no stake. */
export type StandingQueryFamily = 'open_loops' | 'deadlines' | 'recurring_charges';

/** The interruption gate class (named choice: "when it bothers you"). */
export type JudgmentClass = 'interrupt' | 'digest' | 'silent';

// --- The standing structure (what the fixtures hold, pre-projection) ---

/** The ATMS label under a stake (kernel AK5.4). `complete=false` renders
 *  explored-frontier wording with the pruned count; a bounded label never
 *  says "all". */
export interface AtmsLabel {
  readonly assumptionIds: readonly string[];
  readonly complete: boolean;
  readonly prunedCount: number;
}

/** A stake: "this matters to me" (kernel AK1). Anchors the back-index (AE1). */
export interface StakeNode {
  readonly id: string;
  readonly kind: 'stake';
  readonly statement: string;
  readonly label: AtmsLabel;
  readonly author: PgAuthor;
  readonly disabled: boolean;
}

/** An assumption: "what this rests on" (the derived kind). Never authored; it
 *  comes from the stake's ATMS label and can be pruned from the back-index for
 *  one stake only. */
export interface AssumptionNode {
  readonly id: string;
  readonly kind: 'assumption';
  readonly statement: string;
  readonly restsOn: string;
  /** Which sources could change this assumption (rendered in the assumption
   *  view; not a primary graph edge, to keep the join layer crisp). */
  readonly couldChangeSourceIds: readonly string[];
  readonly stakeId: string;
  readonly pruned: boolean;
}

/** A source: "where it hears things" (a DataWave life source). */
export interface SourceNode {
  readonly id: string;
  readonly kind: 'source';
  readonly lifeKind: LifeSourceKind;
  readonly label: string;
  readonly ingest: IngestState;
  readonly disabled: boolean;
}

/** A watch: "what it looks for" (a standing program). */
export interface WatchNode {
  readonly id: string;
  readonly kind: 'watch';
  readonly subKind: WatchSubKind;
  readonly statement: string;
  /** Human-legible condition and its editable parameters (PG4). */
  readonly condition: string;
  readonly conditionParams: Readonly<Record<string, string | number>>;
  /** Sources this watch reads (editable; PG4). */
  readonly sourceIds: readonly string[];
  /** For a derived watch, the stake whose label produced it. */
  readonly stakeId?: string;
  /** For an authored watch, its standing-query family. */
  readonly queryFamily?: StandingQueryFamily;
  readonly author: PgAuthor;
  readonly disabled: boolean;
}

/** A judgment: "when it bothers you" (the interruption gate). */
export interface JudgmentNode {
  readonly id: string;
  readonly kind: 'judgment';
  readonly judgmentClass: JudgmentClass;
  readonly thresholds: Readonly<Record<string, string | number>>;
  /** The watch this judgment gates. */
  readonly watchId: string;
  readonly author: PgAuthor;
  readonly disabled: boolean;
}

/** The typed blocks a response is made of (the node-model grammar). `prepare`
 *  assembles ("find the deadline, gather the correspondence"), `verify` checks
 *  feasibility before proposing (the verified-cognition layer, made visible),
 *  `action` is the terminal effect, and `custom` is unthemed (its shape cannot
 *  tell you what it does, so it is compiled from intent, never hand-written). */
export type ResponseBlockType = 'prepare' | 'verify' | 'action' | 'custom';

/** One step in a response's agent action. Actions are programmed by stacking
 *  typed blocks (the git-graph building block): each step is a row a person adds
 *  to the node to build up what the agent does when the response fires. Steps
 *  are attention/plan only; they never widen the Grant or the EffectContract
 *  (the grant boundary holds, PG7 gate 2). */
export interface ActionStep {
  readonly id: string;
  readonly label: string;
  /** The typed block this step is. Absent means derived: an untyped step is a
   *  `prepare` block, and the terminal effect is always the `action`. */
  readonly type?: ResponseBlockType;
  /** A branch label when this step forks the response rail (if/then is
   *  fork/merge topology, the git-graph primitive). Absent means the trunk;
   *  `then`/`else` steps fork and rejoin at the terminal action (the merge). */
  readonly branch?: 'then' | 'else';
}

/** A response: "what it does about it" (an action class resolving to an
 *  EffectContract, bounded by a Grant). Its agent action is a stack of steps a
 *  person builds up on the node. */
export interface ResponseNode {
  readonly id: string;
  readonly kind: 'response';
  /** The named action class, resolved to an EffectContract by code. */
  readonly actionClass: string;
  /** The judgment upstream of this response. */
  readonly judgmentId: string;
  readonly author: PgAuthor;
  readonly disabled: boolean;
  /** The stacked agent-action steps. Absent or empty renders one derived row
   *  (the effect contract's action); a person stacks more to build the action. */
  readonly steps?: readonly ActionStep[];
}

export type StandingNode =
  | StakeNode
  | AssumptionNode
  | SourceNode
  | WatchNode
  | JudgmentNode
  | ResponseNode;

// --- Code-owned objects the projection resolves against (kernel AK2, Grants,
//     the standing budget). These live behind code; the surface reads them and
//     never writes them (the grant boundary, PG7 gate 2). ---

/** An EffectContract (kernel AK2), owned by code, that an action class resolves
 *  to. Whether a response may execute depends on a Grant this graph never
 *  touches; the worst an edit does is cause worse or more proposals. */
export interface EffectContract {
  readonly id: string;
  readonly actionClass: string;
  readonly title: string;
  /** What the action would do, in one plain line. */
  readonly summary: string;
  /** Reversibility disclosure (rendered on the response). */
  readonly reversible: boolean;
  /** The capability class the action belongs to (e.g. `send:email`). */
  readonly capabilityClass: string;
  /** Per-firing standing spend charged against the budget cap. */
  readonly perFiringSpend: number;
}

/** A signed Grant (kernel AK6/AK7): the standing capability and standing spend
 *  authority. Absent means "will ask you every time". */
export interface Grant {
  readonly id: string;
  readonly capabilityClass: string;
  readonly grantedOn: string;
  readonly revocable: boolean;
  readonly expiresOn?: string;
}

/** The standing budget for a capability class (verify-first V7). A standing
 *  program is a standing spend as well as a standing capability. */
export interface StandingBudget {
  readonly capabilityClass: string;
  readonly cap: number;
  /** Spend already committed by other running programs in this class. */
  readonly committedSpend: number;
}

/** The whole fixture standing structure for one tenant. */
export interface StandingStructure {
  readonly nodes: readonly StandingNode[];
  readonly effectContracts: readonly EffectContract[];
  readonly grants: readonly Grant[];
  readonly budgets: readonly StandingBudget[];
}

// --- The projection output (what the surface renders) ---

/** Permission state rendered on every response (named choice 7). */
export interface PermissionState {
  readonly hasGrant: boolean;
  readonly grantedOn?: string;
  readonly revocable?: boolean;
  readonly expiresOn?: string;
  readonly capabilityClass: string;
}

/** Budget state rendered on every response (named choice 7). An over-budget
 *  node renders over-budget and does not run (the budget boundary). `cap` is
 *  null when the capability carries no standing cap (kept JSON-safe: never
 *  Infinity, which the block-view wire would coerce to null anyway). */
export interface BudgetState {
  readonly cap: number | null;
  readonly committedSpend: number;
  readonly perFiringSpend: number;
  readonly projectedSpend: number;
  readonly overBudget: boolean;
}

/** A degraded reason names the consequence out loud (named choice 2): a watch
 *  whose source is disabled says so rather than going dark silently. */
export interface DegradedState {
  readonly degraded: boolean;
  /** The plain consequence, e.g. "this can no longer see your email". */
  readonly consequence?: string;
  /** The node ids whose disable caused this degradation. */
  readonly causeIds: readonly string[];
}

export type ProjectedNode =
  | (StakeNode & { readonly degraded: DegradedState })
  | (AssumptionNode & { readonly degraded: DegradedState })
  | (SourceNode & { readonly degraded: DegradedState })
  | (WatchNode & { readonly degraded: DegradedState })
  | (JudgmentNode & { readonly degraded: DegradedState })
  | (ResponseNode & {
      readonly degraded: DegradedState;
      readonly effectContract: EffectContract;
      readonly permission: PermissionState;
      readonly budget: BudgetState;
    });

/** A directed edge in the standing graph. The two-sided convergence lives at
 *  the watch: `feeds` (a source into a watch) and `declares` (a stake into its
 *  derived watch) both arrive there, so a firing requires both (named choice
 *  8). `rests_on` is the stake side origin. */
export type PgEdgeKind = 'rests_on' | 'feeds' | 'declares' | 'gates' | 'acts';

export interface PgEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: PgEdgeKind;
}

export interface ProactivityGraph {
  readonly tenant: string;
  readonly nodes: readonly ProjectedNode[];
  readonly edges: readonly PgEdge[];
}

/** The tenant refusal (named choice 10): a missing tenant is a refusal, never
 *  an empty graph. */
export interface ProactivityRefusal {
  readonly refused: true;
  readonly reason: 'missing_tenant';
}

export type ProjectionResult = ProactivityGraph | ProactivityRefusal;

export function isRefusal(result: ProjectionResult): result is ProactivityRefusal {
  return 'refused' in result;
}

/** The response projection carries the three code-owned resolutions. */
export type ProjectedResponse = Extract<ProjectedNode, { kind: 'response' }>;

export function isResponse(node: ProjectedNode): node is ProjectedResponse {
  return node.kind === 'response';
}

/** Every node kind except assumption carries a disable switch. An assumption's
 *  consent affordance is prune (named choice 6), not disable, so it is excluded
 *  here and the disable control is never rendered for it. */
export type DisableableNode = Exclude<ProjectedNode, { kind: 'assumption' }>;

export function isDisableable(node: ProjectedNode): node is DisableableNode {
  return node.kind !== 'assumption';
}

/** Safe disabled read across the union (assumptions have no disable switch). */
export function nodeDisabled(node: ProjectedNode): boolean {
  return node.kind !== 'assumption' && node.disabled;
}
