// SOURCING: none. The decompile side of Forme (verify-first V9: Forme is
// ABSENT; this is the stub behind the interface). A standing program decompiles
// into a sentence a non-technical reader understands (named choice 5). The
// sentence is a pure function of the nodes, and its editable pieces are tokens
// bound directly to a node field, so "editing the sentence" is a field write on
// the same object: the three altitudes cannot drift, and the round trip is
// stable by construction (PG7 gate 6). When real Forme lands it replaces this
// decompile behind the FormeEngine interface; the view is unchanged.

import type {
  JudgmentClass,
  ProactivityGraph,
  ProjectedNode,
  ProjectedResponse,
  WatchNode,
} from './model';

/** How an inline sentence token may be edited (also drives the card controls,
 *  PG4). */
export type EditableSpec =
  | { readonly control: 'judgmentClass' }
  | { readonly control: 'number'; readonly param: string; readonly min?: number; readonly max?: number }
  | { readonly control: 'sources' }
  | { readonly control: 'actionClass' };

export type SentenceToken =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'param';
      readonly text: string;
      readonly nodeId: string;
      readonly editable: EditableSpec;
    };

/** One decompiled sentence for a node group, with the group's node ids so the
 *  altitude can select and highlight the same object across views. */
export interface SentenceLine {
  readonly id: string;
  readonly nodeIds: readonly string[];
  readonly tokens: readonly SentenceToken[];
  /** A plain permission/budget clause on the program's response, if any. */
  readonly note?: string;
  readonly author: 'agent' | 'human';
}

export interface StakeLine {
  readonly id: string;
  readonly stakeId: string;
  readonly text: string;
  readonly assumptionSummary: string;
  readonly bounded: boolean;
}

export interface SentenceDoc {
  readonly programs: readonly SentenceLine[];
  readonly stakes: readonly StakeLine[];
}

const JUDGMENT_PHRASE: Record<JudgmentClass, string> = {
  interrupt: 'interrupt me',
  digest: 'add it to the digest',
  silent: 'note it silently',
};

function humanSourceList(nodes: readonly ProjectedNode[], sourceIds: readonly string[]): string {
  const labels = sourceIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is Extract<ProjectedNode, { kind: 'source' }> => node?.kind === 'source')
    .map((node) => node.label.toLowerCase());
  if (labels.length === 0) return 'nothing';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}

/** Split a condition template on {param} placeholders into text and param
 *  tokens bound to the watch's condition params. */
function conditionTokens(watch: WatchNode): SentenceToken[] {
  const tokens: SentenceToken[] = [];
  const parts = watch.condition.split(/(\{[a-zA-Z0-9_]+\})/g);
  for (const part of parts) {
    const match = part.match(/^\{([a-zA-Z0-9_]+)\}$/);
    if (match) {
      const param = match[1];
      const value = watch.conditionParams[param];
      tokens.push({
        kind: 'param',
        text: value === undefined ? param : String(value),
        nodeId: watch.id,
        editable: { control: 'number', param },
      });
    } else if (part.length > 0) {
      tokens.push({ kind: 'text', text: part });
    }
  }
  return tokens;
}

/** The permission and budget clause rendered on the program's response
 *  (named choice 7), out loud in the sentence. */
export function responseClause(response: ProjectedResponse): string {
  if (response.budget.overBudget) return 'over budget, not running';
  if (!response.permission.hasGrant) return 'will ask you every time';
  const revocable = response.permission.revocable ? ', revocable' : '';
  return `can act on its own, granted ${response.permission.grantedOn ?? 'unknown'}${revocable}`;
}

/** Decompile a projected graph into its sentences. Deterministic. */
export function decompileGraph(graph: ProactivityGraph): SentenceDoc {
  const nodes = graph.nodes;
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const programs: SentenceLine[] = [];
  for (const watch of nodes) {
    if (watch.kind !== 'watch') continue;
    const judgment = nodes.find((n) => n.kind === 'judgment' && n.watchId === watch.id);
    if (!judgment || judgment.kind !== 'judgment') continue;
    const response = nodes.find((n) => n.kind === 'response' && n.judgmentId === judgment.id);
    if (!response || response.kind !== 'response') continue;

    const stake = watch.stakeId ? byId.get(watch.stakeId) : undefined;
    const tokens: SentenceToken[] = [];

    if (stake && stake.kind === 'stake') {
      tokens.push({ kind: 'text', text: `For "${stake.statement}", watch ` });
    } else {
      tokens.push({ kind: 'text', text: 'Watch ' });
    }
    tokens.push({
      kind: 'param',
      text: humanSourceList(nodes, watch.sourceIds),
      nodeId: watch.id,
      editable: { control: 'sources' },
    });
    tokens.push({ kind: 'text', text: ' for ' });
    tokens.push(...conditionTokens(watch));
    tokens.push({ kind: 'text', text: '. When it fires, ' });
    tokens.push({
      kind: 'param',
      text: JUDGMENT_PHRASE[judgment.judgmentClass],
      nodeId: judgment.id,
      editable: { control: 'judgmentClass' },
    });
    tokens.push({ kind: 'text', text: ', then ' });
    tokens.push({
      kind: 'param',
      text: response.effectContract.title.toLowerCase(),
      nodeId: response.id,
      editable: { control: 'actionClass' },
    });
    tokens.push({ kind: 'text', text: '.' });

    programs.push({
      id: `line-${watch.id}`,
      nodeIds: [
        ...(stake ? [stake.id] : []),
        ...watch.sourceIds,
        watch.id,
        judgment.id,
        response.id,
      ],
      tokens,
      note: responseClause(response),
      author: watch.author,
    });
  }

  const stakes: StakeLine[] = nodes
    .filter((node): node is Extract<ProjectedNode, { kind: 'stake' }> => node.kind === 'stake')
    .map((stake) => {
      const shown = stake.label.assumptionIds.length;
      const bounded = !stake.label.complete;
      const assumptionSummary = bounded
        ? `It rests on ${shown} assumptions so far, with more beyond what has been explored (${stake.label.prunedCount} pruned).`
        : `It rests on ${shown} assumptions.`;
      return {
        id: `stake-line-${stake.id}`,
        stakeId: stake.id,
        text: `"${stake.statement}" matters to me.`,
        assumptionSummary,
        bounded,
      };
    });

  return { programs, stakes };
}

/** Render a sentence line to plain text (for the round-trip property and for
 *  reduced, control-free reading). */
export function lineToText(line: SentenceLine): string {
  const body = line.tokens.map((token) => token.text).join('');
  return line.note ? `${body} (${line.note})` : body;
}
