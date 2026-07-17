import type { ObjectAction } from '@commonplace/block-view/types';
import type { HunkViewModel } from './hunk-contract';

export type HunkReviewAction = 'accept' | 'reject' | 'verify' | 'edit';

export const HUNK_REVIEW_ACTIONS = [
  { id: 'hunk.accept', label: 'Hunk: accept active', key: 'a', action: 'accept' },
  { id: 'hunk.reject', label: 'Hunk: reject active', key: 'r', action: 'reject' },
  { id: 'hunk.verify', label: 'Hunk: verify active', key: 'v', action: 'verify' },
  { id: 'hunk.edit', label: 'Hunk: edit active', key: 'e', action: 'edit' },
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly key: string;
  readonly action: HunkReviewAction;
}[];

export const HUNK_REVIEW_ACTION_EVENT = 'commonplace:hunk-review-action';

export function dispatchHunkReviewAction(action: HunkReviewAction): void {
  window.dispatchEvent(new CustomEvent(HUNK_REVIEW_ACTION_EVENT, { detail: { action } }));
}

export function hunkExecutorAction(
  action: HunkReviewAction,
  targets: readonly HunkViewModel[],
  options: { readonly humanDischarge?: boolean } = {},
): ObjectAction {
  if (targets.length === 0) throw new Error('A Hunk executor action requires at least one target.');
  return {
    kind: 'invoke_tool',
    tool: `hunk.${action}`,
    args: {
      hunk_ids: targets.map((hunk) => hunk.hunkId),
      group_id: targets.length > 1 ? targets[0].groupId ?? null : null,
      target_blocks: targets.map((hunk) => hunk.targetBlock),
      human_discharge: options.humanDischarge === true,
    },
  };
}
