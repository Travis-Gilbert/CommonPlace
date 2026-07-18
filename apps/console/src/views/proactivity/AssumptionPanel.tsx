'use client';

// SOURCING: none. The assumption view (PG6). Expanding a stake renders its
// label-derived assumption set (named choice 6): each assumption shows what it
// rests on and which sources could change it, with a prune control. Pruning
// removes the assumption from the back-index for that stake only, receipted and
// reversible (it is a per-stake assumption node, so it touches no other stake).
// A bounded label (complete = false) renders explored-frontier wording with its
// pruned count and never says "all" (kernel AK5.4).

import type { ProactivityGraph } from '@/lib/proactivity/model';
import { setPrunedAction } from '@/lib/proactivity/node-actions';
import { assumptionsForStake, humanLifeKind, sourcesOf, stakesOf } from './kinds';
import type { ProactivityEdits } from './use-edits';

export function AssumptionPanel({
  graph,
  stakeId,
  edits,
}: {
  readonly graph: ProactivityGraph;
  readonly stakeId: string;
  readonly edits: ProactivityEdits;
}) {
  const stake = stakesOf(graph.nodes).find((candidate) => candidate.id === stakeId);
  const assumptions = assumptionsForStake(graph.nodes, stakeId);
  const sources = sourcesOf(graph.nodes);

  const sourceLabel = (id: string): string => {
    const source = sources.find((candidate) => candidate.id === id);
    return source ? humanLifeKind(source.lifeKind).toLowerCase() : id;
  };

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-ij-arc bg-ij-chrome p-3" data-assumptions={stakeId}>
      {assumptions.map((assumption) => (
        <div key={assumption.id} className="flex items-start justify-between gap-3">
          <div>
            <p className={assumption.pruned ? 'text-ij-ink-disabled line-through' : 'text-ij-ink'}>
              {assumption.statement}
            </p>
            <p className="text-xs text-ij-ink-info">
              Rests on {assumption.restsOn}.
              {assumption.couldChangeSourceIds.length > 0
                ? ` Could change from your ${assumption.couldChangeSourceIds.map(sourceLabel).join(' or ')}.`
                : ''}
            </p>
          </div>
          <button
            type="button"
            className="h-ij-control shrink-0 rounded-ij-arc border border-ij-control-border px-2 text-xs text-ij-ink-info hover:bg-ij-hover-surface"
            onClick={() =>
              void edits.run({
                action: setPrunedAction(assumption.id, !assumption.pruned),
                inverse: setPrunedAction(assumption.id, assumption.pruned),
                label: assumption.pruned ? 'restore assumption' : 'prune assumption',
              })
            }
          >
            {assumption.pruned ? 'Restore' : 'I do not care about that'}
          </button>
        </div>
      ))}
      {stake && !stake.label.complete ? (
        <p className="text-xs text-ij-warn">
          More lie beyond what has been explored ({stake.label.prunedCount} pruned). This is not all of them.
        </p>
      ) : null}
    </div>
  );
}
