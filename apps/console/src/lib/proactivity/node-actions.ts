// SOURCING: @commonplace/block-view (ObjectAction). The action builders for the
// proactivity graph, mirroring hunks/hunk-actions.ts. Every edit is an
// ObjectAction through the block-view seam: disable is an update (never a
// delete, named choice 1), every parameter edit is an update, and committing
// an intent candidate is a create carrying author: human (named choice 4).

import type { JsonValue, ObjectAction } from '@commonplace/block-view/types';
import type { JudgmentClass, StandingNode } from './model';

/** Disable is reversible and receipted, never a delete (named choice 1). */
export function setDisabledAction(id: string, disabled: boolean): ObjectAction {
  return { kind: 'update', id, patch: { disabled } };
}

/** Prune (or restore) an assumption from a stake's back-index (named choice 6). */
export function setPrunedAction(id: string, pruned: boolean): ObjectAction {
  return { kind: 'update', id, patch: { pruned } };
}

export function setJudgmentClassAction(id: string, judgmentClass: JudgmentClass): ObjectAction {
  return { kind: 'update', id, patch: { judgmentClass } };
}

export function setJudgmentThresholdsAction(
  id: string,
  thresholds: Readonly<Record<string, string | number>>,
): ObjectAction {
  return { kind: 'update', id, patch: { thresholds: thresholds as Record<string, JsonValue> } };
}

export function setWatchSourcesAction(id: string, sourceIds: readonly string[]): ObjectAction {
  return { kind: 'update', id, patch: { sourceIds: [...sourceIds] } };
}

export function setConditionParamsAction(
  id: string,
  conditionParams: Readonly<Record<string, string | number>>,
): ObjectAction {
  return { kind: 'update', id, patch: { conditionParams: conditionParams as Record<string, JsonValue> } };
}

export function setActionClassAction(id: string, actionClass: string): ObjectAction {
  return { kind: 'update', id, patch: { actionClass } };
}

/** Commit one intent candidate. The node carries author: human already. */
export function commitCandidateAction(node: StandingNode): ObjectAction {
  return { kind: 'create', type: `pg.${node.kind}`, props: node as unknown as Record<string, JsonValue> };
}
