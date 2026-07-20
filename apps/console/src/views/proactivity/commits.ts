// SOURCING: jalco-ui `@jalco/commit-graph` (adopted, see components/commit-graph.tsx)
// supplies the `Commit` shape this module fills. Everything here is the
// decompiler from a projected proactivity node into that shape; no upstream
// component models the mapping itself, so the mapping is local.

/**
 * The standing program, read as a repository
 * (31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE, "the model"). The mapping is exact,
 * not decorative, and this module is where it is written down once:
 *
 *   watch / judgment / response  ->  a commit (rail dot, short id, message,
 *                                    author, time)
 *   authorship                   ->  a lane (the rail's speaker register)
 *   a watch joining stake and
 *     source streams             ->  a merge commit (two rails converging)
 *   a stake                      ->  a ref, badged on the lineage it names
 *   the active standing program  ->  HEAD
 *   disabling a node             ->  a revert commit
 *   a PG5 candidate              ->  an uncommitted commit ahead of HEAD
 *   a firing                     ->  an execution commit on the agent lane
 *   a grant with expiry          ->  a tag
 *   budget                       ->  a ref decoration (the spend chip)
 *
 * Two things the mapping buys, in the order the doc states them: a person can
 * program the agent by adding commits, because the palette of addable commits
 * is small and legible; and the system can show deterministically what the
 * agent did, because execution is commits with lineage back to the
 * authorization that permitted them.
 */

import type { Commit, CommitLane } from '@/components/commit-graph';
import {
  nodeDisabled,
  type ProactivityGraph,
  type ProjectedNode,
  type ProjectedResponse,
  type StandingNode,
} from '@/lib/proactivity/model';
import { responseClause } from '@/lib/proactivity/sentences';
import { humanClass, humanLifeKind } from './kinds';

/**
 * A short id, the way git shows one. Node ids are readable slugs
 * (`pg-watch-appeal`), which is the wrong register for the machinery column, so
 * this is a stable hash rendered as seven hex characters. Deterministic and
 * pure: the same node always shows the same id, in tests and baselines too.
 *
 * FNV-1a, because the requirement is stability and spread across a few dozen
 * ids, not cryptographic strength: this identifies a row on screen, never
 * anything at rest.
 */
export function shortId(id: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Two rounds so seven characters carry the whole 32-bit spread rather than
  // repeating a short cycle across the small id set this surface holds.
  const second = Math.imul(hash ^ (hash >>> 15), 0x2545f491) >>> 0;
  return `${hash.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`.slice(0, 7);
}

/** Which rail a node rides (named choice 3). Your lane is human ink, the
 *  agent's is teal, and a derived watch carries gold because it was not
 *  authored by either of you: it fell out of a stake's label. */
export function laneOf(node: ProjectedNode): CommitLane {
  if (node.kind === 'watch' && node.subKind === 'derived') return 'derived';
  if (node.kind === 'assumption') return 'derived';
  if (node.kind === 'source') return 'agent';
  return 'author' in node && node.author === 'human' ? 'human' : 'agent';
}

/** The author chip's name. The surface speaks in the second person, so the
 *  human lane is "you", not a login. */
export function authorName(node: ProjectedNode): string {
  return laneOf(node) === 'human' ? 'you' : 'agent';
}

/** A git-style branch label for a stake, so the ref badge reads like a ref.
 *  Content words only, two of them, which is enough to tell two stakes apart
 *  without the badge growing into a sentence. */
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'on', 'in', 'to', 'for', 'and', 'or', 'get', 'keep', 'my', 'your']);

export function stakeRef(statement: string): string {
  const words = statement
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
    .slice(0, 2);
  return `stake/${words.join('-') || 'unnamed'}`;
}

/** The commit message: the decompiled sentence, in the surface's own voice.
 *  Never a field dump; a person reads this row the way they read a git log. */
export function commitMessage(node: ProjectedNode): string {
  switch (node.kind) {
    case 'stake':
      return node.statement;
    case 'assumption':
      return node.statement;
    case 'source':
      return `Reads your ${humanLifeKind(node.lifeKind).toLowerCase()}`;
    case 'watch':
      return node.statement;
    case 'judgment':
      return humanClass(node.judgmentClass);
    case 'response':
      // What it DOES, not what it is allowed to do. The permission clause is a
      // separate claim and rides its own line and its own tag: collapsing the
      // two would leave the row unable to say what the action actually is.
      return node.effectContract.title;
    case 'execution':
      return node.note;
  }
}

/** The permission clause a response commits to, in the accent grammar: over
 *  budget is refused, a grant is learned, no grant asks each time. Shared with
 *  the sentence altitude so the wording cannot drift between them. */
export function permissionClause(response: ProjectedResponse): { text: string; ink: string } {
  if (response.budget.overBudget) return { text: responseClause(response), ink: 'text-ij-error' };
  if (response.permission.hasGrant) return { text: responseClause(response), ink: 'text-ij-gold' };
  return { text: 'asks you every time', ink: 'text-ij-accent' };
}

/** The grant tag on a response commit. A grant is a tag because it is a name
 *  pinned to a point in the history that says "this is authorized"; an expiry
 *  is the part of that claim with a clock on it, so it rides the tag. */
export function grantTag(response: ProjectedResponse): string | undefined {
  const { permission } = response;
  if (!permission.hasGrant) return undefined;
  return permission.expiresOn ? `grant, expires ${permission.expiresOn}` : 'grant';
}

/** The spend chip: budget as ref decoration, over-budget in warn (the mapping
 *  table's last row). */
export function spendChip(response: ProjectedResponse): string {
  const { budget } = response;
  const cap = budget.cap === null ? 'no cap' : `of ${budget.cap}`;
  return `spend ${budget.projectedSpend} ${cap}`;
}

/** Everything a row needs that is not part of the upstream `Commit` shape. */
export interface CommitFacts {
  readonly lane: CommitLane;
  /** The current tip: what actually runs. An enabled, undegraded response that
   *  is inside its budget is HEAD; anything else is history or a dead end. */
  readonly isHead: boolean;
  /** Disabling is a revert (the mapping table). The undo affordance already on
   *  the surface is what reverses it, so no new mutation appears here. */
  readonly isRevert: boolean;
  /** A watch where a source stream and a stake stream both arrive: a true merge
   *  commit, which is what makes the banner sentence a picture. */
  readonly isMerge: boolean;
  /** A candidate is uncommitted work ahead of HEAD, and renders dashed. */
  readonly isCandidate: boolean;
}

export interface CommitView {
  readonly node: ProjectedNode;
  readonly commit: Commit;
  readonly facts: CommitFacts;
}

/** Which watches are merges: a `feeds` edge (a source) and a `declares` edge
 *  (a stake) both arrive (named choice 8 / doc named choice 2). */
export function mergeWatchIds(graph: ProactivityGraph): ReadonlySet<string> {
  const fed = new Set<string>();
  const declared = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind === 'feeds') fed.add(edge.to);
    if (edge.kind === 'declares') declared.add(edge.to);
  }
  return new Set([...fed].filter((id) => declared.has(id)));
}

function isHeadNode(node: ProjectedNode): boolean {
  if (node.kind !== 'response') return false;
  return !node.disabled && !node.degraded.degraded && !node.budget.overBudget;
}

/**
 * Decompile one projected node into the commit the row renders.
 *
 * `parents` come from the graph's inbound edges, so lineage on screen is the
 * lineage in the projection: nothing here invents a relationship. A stake's ref
 * badge is carried down its lineage (the watch it declares and that watch's
 * judgment and response) because a ref names a line of history, not one commit.
 */
export function toCommit(
  node: ProjectedNode,
  context: {
    readonly graph: ProactivityGraph;
    readonly merges: ReadonlySet<string>;
    readonly stakeRefs: ReadonlyMap<string, string>;
    readonly candidate?: boolean;
  },
): CommitView {
  const { graph, merges, stakeRefs } = context;
  const lane = laneOf(node);
  const parents = graph.edges.filter((edge) => edge.to === node.id).map((edge) => shortId(edge.from));

  const refs: string[] = [];
  const ownRef = stakeRefs.get(node.id);
  if (ownRef) refs.push(ownRef);
  if (isHeadNode(node)) refs.push('HEAD');
  if (nodeDisabled(node)) refs.push('revert');
  if (context.candidate) refs.push('uncommitted');
  if (node.kind === 'response') refs.push(spendChip(node));

  return {
    node,
    commit: {
      hash: shortId(node.id),
      message: commitMessage(node),
      author: { name: authorName(node) },
      date: node.kind === 'execution' ? node.firedOn : node.authoredOn,
      parents,
      refs: refs.length > 0 ? refs : undefined,
      tag: node.kind === 'response' ? grantTag(node) : undefined,
      lane,
    },
    facts: {
      lane,
      isHead: isHeadNode(node),
      isRevert: nodeDisabled(node),
      isMerge: node.kind === 'watch' && merges.has(node.id),
      isCandidate: context.candidate ?? false,
    },
  };
}

/**
 * The commit log: the program's commits in the order `CommitGraph` renders
 * them, which is topological and newest-first.
 *
 * This is what the adopted component was built to draw, and the reason it
 * exists here. A canvas of positioned nodes shows you TOPOLOGY; a log shows you
 * HISTORY, with the rail spine, the lane colors, and the curved merges that
 * make a commit graph legible at a glance. The repository mapping is not
 * complete without it: you cannot claim the standing program is a repository
 * and then never show its log.
 *
 * Order: sinks first (a response and its executions are the newest thing that
 * happened), roots last (a source or a stake is where the lineage begins), with
 * date breaking ties. `computeLayout` allocates rails from this order, so
 * getting it right is what produces real merges rather than a straight column.
 */
export function commitLog(graph: ProactivityGraph): Commit[] {
  const merges = mergeWatchIds(graph);
  const stakeRefs = stakeRefIndex(graph);

  // Depth from the roots: how far downstream a commit sits. A response is
  // deeper than the watch that gates it, which is deeper than the source that
  // feeds it, so descending depth is newest-first.
  const parentsOf = new Map<string, string[]>();
  for (const edge of graph.edges) {
    parentsOf.set(edge.to, [...(parentsOf.get(edge.to) ?? []), edge.from]);
  }
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen: ReadonlySet<string> = new Set()): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    // A cycle cannot happen in this projection, but a guard costs nothing and
    // an infinite recursion in a render path costs everything.
    if (seen.has(id)) return 0;
    const next = new Set(seen).add(id);
    const parents = parentsOf.get(id) ?? [];
    const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((parent) => depthOf(parent, next)));
    depth.set(id, value);
    return value;
  };

  const ordered = [...graph.nodes].sort((a, b) => {
    const byDepth = depthOf(b.id) - depthOf(a.id);
    if (byDepth !== 0) return byDepth;
    const aDate = a.kind === 'execution' ? a.firedOn : a.authoredOn;
    const bDate = b.kind === 'execution' ? b.firedOn : b.authoredOn;
    return bDate.localeCompare(aDate);
  });

  return ordered.map((node) => toCommit(node, { graph, merges, stakeRefs }).commit);
}

/**
 * The lineage a firing lit (channel 3, rendered): the newest execution commit,
 * the response it is parented to, and everything upstream of that response back
 * to the sources and the stake. Lighting the ancestry rather than the node is
 * the point: what you want to see after a firing is the whole chain of reasons
 * that produced it, which is exactly what a commit's ancestry is.
 *
 * Deterministic by construction (newest by `firedOn`), so the visual gate can
 * hold it. The execution set is the fixture seam today and the SSE feed later;
 * this function does not care which filled it.
 */
export function litLineage(graph: ProactivityGraph): ReadonlySet<string> {
  const executions = graph.nodes.filter((node) => node.kind === 'execution');
  if (executions.length === 0) return new Set();
  const newest = executions.reduce((latest, node) =>
    node.kind === 'execution' && latest.kind === 'execution' && node.firedOn > latest.firedOn ? node : latest,
  );
  if (newest.kind !== 'execution') return new Set();

  const inbound = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = inbound.get(edge.to) ?? [];
    list.push(edge.from);
    inbound.set(edge.to, list);
  }

  const lit = new Set<string>([newest.id]);
  const queue = [newest.responseId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || lit.has(id)) continue;
    lit.add(id);
    for (const parent of inbound.get(id) ?? []) queue.push(parent);
  }
  return lit;
}

/**
 * A candidate commit: PG5 compiler output, uncommitted, ahead of HEAD. It is a
 * `StandingNode` rather than a projected one because it does not exist yet, so
 * it has no degraded state, no resolved contract, and no lineage: it is exactly
 * what `git status` shows you before you commit.
 */
export function candidateCommit(node: StandingNode): Commit {
  // A `StandingNode` is the pre-projection union, so the message comes from
  // whichever field that kind states itself in. `label` is deliberately not a
  // fallback: it is a sentence on a source and an ATMS label on a stake, and
  // conflating the two is how a card ends up rendering an object.
  const message = (() => {
    switch (node.kind) {
      case 'stake':
      case 'assumption':
      case 'watch':
        return node.statement;
      case 'judgment':
        return humanClass(node.judgmentClass);
      case 'response':
        return node.actionClass;
      case 'source':
        return node.label;
    }
  })();
  return {
    hash: shortId(node.id),
    message,
    author: { name: 'you' },
    // A candidate was compiled just now, which is what its row should say.
    date: new Date().toISOString(),
    parents: [],
    refs: ['uncommitted'],
    lane: 'human',
  };
}

/**
 * The stake-ref index: which nodes carry which stake's ref badge. A stake names
 * its own ref, and the lineage it declares inherits it, so reading down a rail
 * tells you which stake that rail is protecting without opening anything.
 */
export function stakeRefIndex(graph: ProactivityGraph): ReadonlyMap<string, string> {
  const refs = new Map<string, string>();
  const stakes = new Map<string, string>();
  for (const node of graph.nodes) {
    if (node.kind !== 'stake') continue;
    const ref = stakeRef(node.statement);
    stakes.set(node.id, ref);
    refs.set(node.id, ref);
  }
  // Carry the ref down the lineage the stake declares: stake -> watch -> its
  // judgment -> that judgment's response.
  for (const node of graph.nodes) {
    if (node.kind !== 'watch' || !node.stakeId) continue;
    const ref = stakes.get(node.stakeId);
    if (!ref) continue;
    refs.set(node.id, ref);
    for (const judgment of graph.nodes) {
      if (judgment.kind !== 'judgment' || judgment.watchId !== node.id) continue;
      refs.set(judgment.id, ref);
      for (const response of graph.nodes) {
        if (response.kind === 'response' && response.judgmentId === judgment.id) refs.set(response.id, ref);
      }
    }
  }
  return refs;
}
