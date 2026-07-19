// SOURCING: none. The typed-block decomposition of the standing graph (the
// node-model). A block is what a node is made of, and its vocabulary is fixed by
// the host node kind: the grammar forbids cross-type drops (you cannot put an
// `action` block in a `judgment`), and the constraint is the lesson. This module
// is a PURE decompile over the existing projected fields, never a parallel
// store, so editing a block is one of the existing safe field patches
// (node-actions.ts) and the altitudes cannot drift (sentence outside, blocks
// inside). The palette offers only a kind's legal types; the ones that map to a
// real field are hand-addable, and the rest compile from intent (Forme), never a
// blank hand-written row.

import type { EditableSpec } from './sentences';
import type { JudgmentClass, ProjectedNode, ProjectedResponse } from './model';

/** Every block type across the grammar. `stopping` is shared by watch and stake;
 *  `custom` is the unthemed "any" type. */
export type PgBlockType =
  | 'match'
  | 'threshold'
  | 'and_or'
  | 'not'
  | 'stopping'
  | 'policy'
  | 'prepare'
  | 'verify'
  | 'action'
  | 'custom';

/** One typed block on a node. `rail` is the resolved rail-dot token (the
 *  permission grammar is already applied for a response's action block); the
 *  chip label names the type so it never reads by color alone. `editable`
 *  reuses the sentence editable specs, so a block edits the same field the
 *  sentence token does; absent means derived (read-only). */
export interface PgBlock {
  readonly id: string;
  readonly type: PgBlockType;
  readonly nodeId: string;
  readonly label: string;
  readonly rail: string;
  readonly chip: string;
  readonly editable?: EditableSpec;
  readonly branch?: 'then' | 'else';
}

// The rail-dot token per block type, register-mapped and meaning-carrying: the
// host domain tint dominates, logical blocks read neutral, verify reads as a
// pending check (the verified-cognition layer), and custom is deliberately the
// unthemed neutral stop. A response's `action` rail is overridden at build time
// by the permission grammar (gold granted, accent asks, error over budget).
const BLOCK_RAIL: Record<PgBlockType, string> = {
  match: 'var(--ij-agent)',
  threshold: 'var(--ij-agent)',
  and_or: 'var(--ij-ink-info)',
  not: 'var(--ij-ink-info)',
  stopping: 'var(--ij-graph)',
  policy: 'var(--ij-room)',
  prepare: 'var(--ij-ink-info)',
  verify: 'var(--ij-accent)',
  action: 'var(--ij-accent)',
  custom: 'var(--ij-ink-disabled)',
};

const BLOCK_CHIP: Record<PgBlockType, string> = {
  match: 'match',
  threshold: 'threshold',
  and_or: 'any/all',
  not: 'not',
  stopping: 'stopping',
  policy: 'policy',
  prepare: 'prepare',
  verify: 'verify',
  action: 'action',
  custom: 'custom',
};

const JUDGMENT_PHRASE: Record<JudgmentClass, string> = {
  interrupt: 'interrupt me',
  digest: 'add it to the digest',
  silent: 'note it silently',
};

/** The legal block types a host kind can carry (the grammar). Source and
 *  assumption are atomic: they are not made of blocks. */
export function legalBlockTypes(kind: ProjectedNode['kind']): readonly PgBlockType[] {
  switch (kind) {
    case 'watch':
      return ['match', 'threshold', 'and_or', 'not', 'stopping'];
    case 'judgment':
      return ['policy'];
    case 'response':
      return ['prepare', 'verify', 'action', 'custom'];
    case 'stake':
      return ['stopping'];
    default:
      return [];
  }
}

// The types a person adds directly, as a typed response step. Every other legal
// type is compile-only: adding it opens the intent composer (Forme) rather than
// a blank row, which keeps arbitrary logic compiled from intent (never
// hand-written) and the blank canvas closed. Existing thresholds stay editable
// in place; only ADDING a fresh condition compiles from intent.
const HAND_ADDABLE: ReadonlySet<PgBlockType> = new Set<PgBlockType>(['prepare', 'verify']);

export function isCompileOnly(type: PgBlockType): boolean {
  return !HAND_ADDABLE.has(type);
}

/** Strip a condition template's {param} placeholders to an ellipsis so the match
 *  block reads as a phrase; the values live in their own threshold blocks. */
function matchPhrase(condition: string): string {
  return condition.replace(/\{[a-zA-Z0-9_]+\}/g, '…').trim();
}

function watchBlocks(node: Extract<ProjectedNode, { kind: 'watch' }>): PgBlock[] {
  const blocks: PgBlock[] = [
    {
      id: `${node.id}-b-match`,
      type: 'match',
      nodeId: node.id,
      label: matchPhrase(node.condition),
      rail: BLOCK_RAIL.match,
      chip: BLOCK_CHIP.match,
    },
  ];
  for (const [param, value] of Object.entries(node.conditionParams)) {
    if (typeof value !== 'number') continue;
    blocks.push({
      id: `${node.id}-b-thr-${param}`,
      type: 'threshold',
      nodeId: node.id,
      label: `${param} is ${value}`,
      rail: BLOCK_RAIL.threshold,
      chip: BLOCK_CHIP.threshold,
      editable: { control: 'number', param },
    });
  }
  // A derived any/all block when the watch reads more than one source: editing
  // the sources is what changes the disjunction, so it is real, not decorative.
  if (node.sourceIds.length > 1) {
    blocks.push({
      id: `${node.id}-b-anyor`,
      type: 'and_or',
      nodeId: node.id,
      label: `any of your ${node.sourceIds.length} sources`,
      rail: BLOCK_RAIL.and_or,
      chip: BLOCK_CHIP.and_or,
      editable: { control: 'sources' },
    });
  }
  return blocks;
}

function judgmentBlocks(node: Extract<ProjectedNode, { kind: 'judgment' }>): PgBlock[] {
  // A judgment is its policy: one block carrying the interruption class. Its
  // thresholds are the upstream watch's parameters, edited there, so they are
  // not duplicated as separate editable blocks here.
  return [
    {
      id: `${node.id}-b-policy`,
      type: 'policy',
      nodeId: node.id,
      label: JUDGMENT_PHRASE[node.judgmentClass],
      rail: BLOCK_RAIL.policy,
      chip: BLOCK_CHIP.policy,
      editable: { control: 'judgmentClass' },
    },
  ];
}

/** The permission grammar on a response's terminal action block: over budget is
 *  refused (error), a grant is learned (gold), no grant asks each time (accent).
 *  This mirrors the response meta on the node face so the two cannot diverge. */
function actionRail(node: ProjectedResponse): string {
  if (node.budget.overBudget) return 'var(--ij-error)';
  if (node.permission.hasGrant) return 'var(--ij-gold)';
  return 'var(--ij-accent)';
}

/** An untyped step is a prepare block; the terminal effect is always the action
 *  (a separate block resolved from the EffectContract). */
function stepType(step: { readonly type?: PgBlockType }): PgBlockType {
  return step.type ?? 'prepare';
}

function responseBlocks(node: ProjectedResponse): PgBlock[] {
  const steps = node.steps ?? [];
  const blocks: PgBlock[] = steps.map((step) => {
    const type = stepType(step);
    return {
      id: step.id,
      type,
      nodeId: node.id,
      label: step.label,
      rail: BLOCK_RAIL[type],
      chip: BLOCK_CHIP[type],
      branch: step.branch,
    };
  });
  // The terminal action block, resolved from the code-owned EffectContract. It
  // carries the permission grammar rail and is never a hand-written label (the
  // effect is code-owned, so the block is read-only here and edited only through
  // the action-class control, the grant boundary).
  blocks.push({
    id: `${node.id}-b-action`,
    type: 'action',
    nodeId: node.id,
    label: node.effectContract.title,
    rail: actionRail(node),
    chip: BLOCK_CHIP.action,
    editable: { control: 'actionClass' },
  });
  return blocks;
}

/**
 * Decompile a projected node into its typed blocks. Pure and deterministic. A
 * stake carries no derived block yet (frontier honesty: a stopping condition is
 * offered by the palette, compiled from intent, never faked); source and
 * assumption are atomic.
 */
export function blocksForNode(node: ProjectedNode): readonly PgBlock[] {
  switch (node.kind) {
    case 'watch':
      return watchBlocks(node);
    case 'judgment':
      return judgmentBlocks(node);
    case 'response':
      return responseBlocks(node);
    default:
      return [];
  }
}
