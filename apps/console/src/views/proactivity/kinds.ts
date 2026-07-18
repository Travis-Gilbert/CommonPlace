// SOURCING: none. Pure view helpers for the proactivity surface: node-kind
// identity (a text label, a distinct graph shape, and a domain tint, never
// color alone, per DESIGN.md), and the grouping of the projected graph into
// standing programs and stakes the card and graph altitudes render. Tints are
// register domain accents only; the response's accent/gold/error state is the
// accent grammar (pending on accent, learned on gold) and lives on the badges,
// not here.

import type {
  PgNodeKind,
  ProjectedNode,
  ProjectedResponse,
} from '@/lib/proactivity/model';

type Projected<K extends PgNodeKind> = Extract<ProjectedNode, { kind: K }>;

export interface KindMeta {
  readonly label: string;
  /** Tailwind text utility aliased from a register token. */
  readonly ink: string;
  /** Tailwind background utility aliased from a register token. */
  readonly tint: string;
  /** The graph node shape, so kind reads without color (join honesty). */
  readonly shape: 'diamond' | 'cylinder' | 'hexagon' | 'circle' | 'rounded' | 'dot';
}

export const KIND_META: Record<PgNodeKind, KindMeta> = {
  stake: { label: 'Stake', ink: 'text-ij-graph', tint: 'bg-ij-graph-tint', shape: 'diamond' },
  source: { label: 'Source', ink: 'text-ij-memory', tint: 'bg-ij-memory-tint', shape: 'cylinder' },
  watch: { label: 'Watch', ink: 'text-ij-agent', tint: 'bg-ij-agent-tint', shape: 'hexagon' },
  judgment: { label: 'Judgment', ink: 'text-ij-room', tint: 'bg-ij-room-tint', shape: 'circle' },
  response: { label: 'Response', ink: 'text-ij-ink', tint: 'bg-ij-raised', shape: 'rounded' },
  assumption: { label: 'Assumption', ink: 'text-ij-ink-info', tint: 'bg-ij-chrome', shape: 'dot' },
};

/** The body face for a node's content, by author (the console typography
 *  system): the human speaks in Manrope at an extra-light weight, everyone else
 *  in the chrome/agent Plex (an empty string, which inherits the chrome face).
 *  Titles (font-cp-title, Vollkorn) and metadata (font-ij-mono, JetBrains) are
 *  applied on their own elements and are universal to author. */
export function bodyFontClass(node: ProjectedNode): string {
  const author = 'author' in node ? node.author : 'agent';
  return author === 'human' ? 'font-cp-human font-extralight' : '';
}

/** A standing program: a watch and its downstream, plus its stake and sources. */
export interface ProgramView {
  readonly id: string;
  readonly stake?: Projected<'stake'>;
  readonly sources: readonly Projected<'source'>[];
  readonly watch: Projected<'watch'>;
  readonly judgment: Projected<'judgment'>;
  readonly response: ProjectedResponse;
}

function isKind<K extends PgNodeKind>(kind: K) {
  return (node: ProjectedNode): node is Projected<K> => node.kind === kind;
}

export function stakesOf(nodes: readonly ProjectedNode[]): readonly Projected<'stake'>[] {
  return nodes.filter(isKind('stake'));
}

export function sourcesOf(nodes: readonly ProjectedNode[]): readonly Projected<'source'>[] {
  return nodes.filter(isKind('source'));
}

export function assumptionsForStake(
  nodes: readonly ProjectedNode[],
  stakeId: string,
): readonly Projected<'assumption'>[] {
  return nodes.filter(isKind('assumption')).filter((assumption) => assumption.stakeId === stakeId);
}

/** Cluster the projected graph into standing programs (watch chains). A chain
 *  with a missing judgment or response is skipped, never half-rendered. */
export function groupPrograms(nodes: readonly ProjectedNode[]): ProgramView[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const programs: ProgramView[] = [];
  for (const watch of nodes) {
    if (watch.kind !== 'watch') continue;
    const judgment = nodes.find((node) => node.kind === 'judgment' && node.watchId === watch.id);
    if (!judgment || judgment.kind !== 'judgment') continue;
    const response = nodes.find((node) => node.kind === 'response' && node.judgmentId === judgment.id);
    if (!response || response.kind !== 'response') continue;
    const stakeNode = watch.stakeId ? byId.get(watch.stakeId) : undefined;
    const stake = stakeNode && stakeNode.kind === 'stake' ? stakeNode : undefined;
    const sources = watch.sourceIds
      .map((id) => byId.get(id))
      .filter((node): node is Projected<'source'> => node?.kind === 'source');
    programs.push({ id: `program-${watch.id}`, stake, sources, watch, judgment, response });
  }
  return programs;
}

export function humanClass(judgmentClass: string): string {
  switch (judgmentClass) {
    case 'interrupt':
      return 'Interrupt me';
    case 'digest':
      return 'Add to digest';
    case 'silent':
      return 'Note silently';
    default:
      return judgmentClass;
  }
}

export function humanLifeKind(lifeKind: string): string {
  switch (lifeKind) {
    case 'life_email':
      return 'Email';
    case 'life_event':
      return 'Calendar';
    case 'life_sms':
      return 'Messages';
    case 'life_call':
      return 'Calls';
    case 'life_clock':
      return 'Clock';
    default:
      return lifeKind;
  }
}
