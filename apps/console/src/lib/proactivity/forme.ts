// SOURCING: none. The compile side of Forme (verify-first V9: Forme is ABSENT;
// this is the stub behind the FormeEngine interface). A person writes plain
// language; Forme compiles it into candidate nodes for review (named choice 4).
// The stub recognizes a bounded set of intent shapes and fails honestly on the
// rest, naming what it could not resolve, never a silent partial. It never
// invents an EffectContract (AK2 is code-owned), so an intent whose action has
// no contract fails rather than granting itself capability. When real Forme
// lands it replaces compileIntent behind this interface; the review UI is
// unchanged.

import type {
  EffectContract,
  JudgmentNode,
  ResponseNode,
  SourceNode,
  StakeNode,
  StandingNode,
  WatchNode,
} from './model';
import { decompileGraph, type SentenceDoc } from './sentences';
import type { ProactivityGraph } from './model';

export interface IntentContext {
  /** The tenant's existing sources, so a compiled watch reads real sources. */
  readonly sources: readonly SourceNode[];
  /** The code-owned effect contracts a response may resolve to. Compile never
   *  invents one. */
  readonly contracts: readonly EffectContract[];
  /** A stable id prefix so compiled candidates are deterministic per intent. */
  readonly idPrefix: string;
}

export interface IntentCompileSuccess {
  readonly ok: true;
  /** The candidate nodes, author already stamped human. */
  readonly candidates: readonly StandingNode[];
  /** What it made and why, shown for review before anything goes live. */
  readonly rationale: string;
}

export interface IntentCompileFailure {
  readonly ok: false;
  /** What it could not resolve (honest failure, never a silent partial). */
  readonly reason: string;
}

export type IntentCompileResult = IntentCompileSuccess | IntentCompileFailure;

export interface FormeEngine {
  decompile(graph: ProactivityGraph): SentenceDoc;
  compileIntent(intent: string, context: IntentContext): IntentCompileResult;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'intent';
}

function sourcesByKinds(context: IntentContext, kinds: readonly string[]): string[] {
  const ids = context.sources.filter((source) => kinds.includes(source.lifeKind)).map((source) => source.id);
  // Fall back to any available source so a compiled watch always reads
  // something real; an empty tenant is handled by the caller.
  return ids.length > 0 ? ids : context.sources.slice(0, 1).map((source) => source.id);
}

function hasContract(context: IntentContext, actionClass: string): boolean {
  return context.contracts.some((contract) => contract.actionClass === actionClass);
}

/** Build the standard authored trio (watch, judgment, response) that the
 *  five-minute test describes: "the three nodes it compiled into". */
function authoredTrio(input: {
  readonly idPrefix: string;
  readonly statement: string;
  readonly condition: string;
  readonly conditionParams: Readonly<Record<string, string | number>>;
  readonly sourceIds: readonly string[];
  readonly queryFamily: WatchNode['queryFamily'];
  readonly actionClass: string;
}): StandingNode[] {
  const watch: WatchNode = {
    id: `${input.idPrefix}-watch`,
    kind: 'watch',
    subKind: 'authored',
    statement: input.statement,
    condition: input.condition,
    conditionParams: input.conditionParams,
    sourceIds: input.sourceIds,
    queryFamily: input.queryFamily,
    author: 'human',
    disabled: false,
  };
  const judgment: JudgmentNode = {
    id: `${input.idPrefix}-judg`,
    kind: 'judgment',
    judgmentClass: 'digest',
    thresholds: input.conditionParams,
    watchId: watch.id,
    author: 'human',
    disabled: false,
  };
  const response: ResponseNode = {
    id: `${input.idPrefix}-resp`,
    kind: 'response',
    actionClass: input.actionClass,
    judgmentId: judgment.id,
    author: 'human',
    disabled: false,
  };
  return [watch, judgment, response];
}

export function compileIntent(intent: string, context: IntentContext): IntentCompileResult {
  const text = intent.trim();
  if (text.length < 4) {
    return { ok: false, reason: 'The intent was too short to resolve. Say what should be noticed.' };
  }
  if (context.sources.length === 0) {
    return { ok: false, reason: 'There are no connected sources yet, so there is nothing for a watch to read.' };
  }
  const lower = text.toLowerCase();
  const prefix = `${context.idPrefix}-${slug(text)}`;

  // Honest refusal: an action the surface has no EffectContract for cannot be
  // compiled, because a node cannot grant itself capability (AK2). Matched on
  // action verbs only: nouns like "charge" (a recurring charge) and "book" (my
  // book) name things to watch or help with, not actions to perform, and must
  // reach their safe compilers below rather than being refused here.
  if (/\b(pay|send money|transfer|purchase|buy)\b/.test(lower)) {
    return {
      ok: false,
      reason: 'That asks for an action I have no effect contract for (paying, sending money, or purchasing). I will not invent one, so I cannot compile it. I can watch and notify instead.',
    };
  }

  // Pattern B: "tell me when X goes quiet" / open-loop watching.
  const quiet = lower.match(/(?:tell me |let me know |notify me )?when (?:anyone |someone |whoever )?(.+?) (?:goes|go) quiet/);
  if (quiet) {
    if (!hasContract(context, 'draft_nudge')) {
      return { ok: false, reason: 'I can watch for that, but I have no effect contract to act on it (draft_nudge is missing).' };
    }
    const subject = quiet[1].trim();
    return {
      ok: true,
      candidates: authoredTrio({
        idPrefix: prefix,
        statement: `${subject} goes quiet`,
        condition: `${subject} has not replied in {quietDays} days`,
        conditionParams: { quietDays: 3 },
        sourceIds: sourcesByKinds(context, ['life_email', 'life_sms']),
        queryFamily: 'open_loops',
        actionClass: 'draft_nudge',
      }),
      rationale: `Made an authored watch for "${subject}" reading your email and messages, a digest judgment, and a draft-a-nudge response that will ask you every time. No stake, because this protects a standing query, not a particular commitment.`,
    };
  }

  // Pattern C: subscriptions / recurring charges.
  if (/\b(subscription|renew|recurring|charge|billing)\b/.test(lower)) {
    if (!hasContract(context, 'notify_digest')) {
      return { ok: false, reason: 'I can watch for that, but I have no notify effect contract to act on it.' };
    }
    return {
      ok: true,
      candidates: authoredTrio({
        idPrefix: prefix,
        statement: 'A subscription renews or changes price',
        condition: 'a recurring charge over {amount} appears',
        conditionParams: { amount: 20 },
        sourceIds: sourcesByKinds(context, ['life_email']),
        queryFamily: 'recurring_charges',
        actionClass: 'notify_digest',
      }),
      rationale: 'Made an authored watch for recurring charges reading your email, a digest judgment, and an add-to-digest response.',
    };
  }

  // Pattern A: "help with X" -> a stake and its derived program.
  const help = lower.match(/(?:i want |please )?help (?:me )?with (?:the |my )?(.+)/) ?? lower.match(/(?:stay on top of|keep up with|track) (?:the |my )?(.+)/);
  if (help) {
    if (!hasContract(context, 'notify_digest')) {
      return { ok: false, reason: 'I can make a stake, but I have no notify effect contract to act on it.' };
    }
    const topic = help[1].trim().replace(/[.?!]+$/, '');
    const stake: StakeNode = {
      id: `${prefix}-stake`,
      kind: 'stake',
      statement: `Get ${topic} resolved`,
      label: { assumptionIds: [], complete: false, prunedCount: 0 },
      author: 'human',
      disabled: false,
    };
    const watch: WatchNode = {
      id: `${prefix}-watch`,
      kind: 'watch',
      subKind: 'derived',
      statement: `Updates on ${topic}`,
      condition: `a message about ${topic} arrives`,
      conditionParams: {},
      sourceIds: sourcesByKinds(context, ['life_email']),
      stakeId: stake.id,
      author: 'human',
      disabled: false,
    };
    const judgment: JudgmentNode = {
      id: `${prefix}-judg`,
      kind: 'judgment',
      judgmentClass: 'digest',
      thresholds: {},
      watchId: watch.id,
      author: 'human',
      disabled: false,
    };
    const response: ResponseNode = {
      id: `${prefix}-resp`,
      kind: 'response',
      actionClass: 'notify_digest',
      judgmentId: judgment.id,
      author: 'human',
      disabled: false,
    };
    return {
      ok: true,
      candidates: [stake, watch, judgment, response],
      rationale: `Made a stake "Get ${topic} resolved", a derived watch that reads your email for updates, a digest judgment, and an add-to-digest response. Its assumption frontier is empty until the watch sees evidence.`,
    };
  }

  return {
    ok: false,
    reason: 'I could not resolve what to watch or how to act. Try naming what should be noticed, for example "tell me when the contractor goes quiet" or "help with the insurance appeal".',
  };
}

/** The stub Forme engine. Swapped for the real compile/decompile path when V9
 *  lands, behind this same interface. */
export const stubForme: FormeEngine = {
  decompile: decompileGraph,
  compileIntent,
};
