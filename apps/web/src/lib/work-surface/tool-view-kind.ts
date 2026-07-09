/**
 * Pure tool-part -> view-kind dispatcher for WS3's WorkToolPartView.
 *
 * Two bespoke kinds are genuinely reachable today: 'memory-recall' and
 * 'coordination-ping' are only ever produced by the omnibar's /recall and
 * /ping commands (see omnibar.ts + use-work-thread.ts), never invented
 * server-side data. 'object-set' recognizes the real Theseus
 * `objects_loaded` stage (toolName 'objects', mapped in thread-reducer.ts),
 * whose terminal result carries real `focal_object_ids` — those ids are
 * used to build a genuine ObjectQuery for ObjectSetToolUI. Everything else
 * (pipeline/classify/retrieval/simulation/expression, and any objects part
 * without ids yet) falls back to a plain status line: there is no richer
 * real payload to render for those today.
 */

import type { ObjectQuery } from '@/lib/block-view/types';
import type { WorkToolPart } from './types';

export type ToolViewKind = 'memory-recall' | 'coordination-ping' | 'object-set' | 'status';

export function resolveToolViewKind(part: WorkToolPart): ToolViewKind {
  if (part.toolName === 'memory_recall') return 'memory-recall';
  if (part.toolName === 'coordination_ping') return 'coordination-ping';
  if (part.toolName === 'objects' && part.status === 'complete' && hasFocalObjectIds(part.result)) {
    return 'object-set';
  }
  return 'status';
}

function hasFocalObjectIds(result: WorkToolPart['result']): boolean {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const ids = (result as Record<string, unknown>).focal_object_ids;
  return Array.isArray(ids) && ids.length > 0;
}

/** Builds the real ObjectQuery for an 'object-set' part's focal_object_ids. */
export function objectQueryForFocalIds(part: WorkToolPart): ObjectQuery | null {
  if (!hasFocalObjectIds(part.result)) return null;
  const ids = (part.result as Record<string, unknown>).focal_object_ids as unknown[];
  const stringIds = ids.filter((id): id is string | number => typeof id === 'string' || typeof id === 'number');
  if (stringIds.length === 0) return null;
  return {
    types: [],
    where: {
      kind: 'or',
      any: stringIds.map((id) => ({ kind: 'eq', field: 'id', value: String(id) })),
    },
  };
}
