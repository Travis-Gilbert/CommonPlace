'use client';

// SOURCING: jalco-ui RepoCard (ui.justinlevine.me), structure extraction. The
// card altitude (PG3), the full edit surface (PG4): one object read as a grid of
// cards. A card is card-sized and never spans the screen width (grow basis-80
// max-w-md, the jalco grid layout); wide rows read as bars, not cards. Sources
// carry disable so turning one off shows its dependent watches degrade with the
// consequence named (PG2, named choice 2). Each program card edits the safe
// surface area (sources, condition params, interruption class, action class) and
// carries disable on every node plus the permission and budget on the response
// (named choice 7). Stakes expand to their assumptions (PG6). Every control is
// the same one the graph inspector uses, so the altitudes cannot drift.

import { useState } from 'react';
import type { EffectContract, ProactivityGraph, StakeNode } from '@/lib/proactivity/model';
import {
  ActionClassEditor,
  AuthorTag,
  BudgetBadge,
  DegradedNote,
  DisableControl,
  DisabledTag,
  JudgmentClassEditor,
  KindChip,
  NumberParamEditor,
  PermissionBadge,
  SourcesEditor,
} from './controls';
import { AssumptionPanel } from './AssumptionPanel';
import { groupPrograms, humanLifeKind, sourcesOf, stakesOf } from './kinds';
import { RepoCard, RepoCardDescription } from '@/components/repo-card';
import type { ProactivityEdits } from './use-edits';

// Card sizing: a card grows to fill a column but never past ~28rem, so it stays
// a card and rows wrap into a grid, never one bar the width of the screen.
const CARD_SIZE = 'grow basis-80 max-w-md';

/** The stake's assumption frontier, honest about being bounded (PG6): it names a
 *  count and says "so far" when more remains, never "all". */
function stakeSummary(stake: StakeNode): string {
  const count = stake.label.assumptionIds.length;
  if (stake.label.complete) return `Rests on ${count} assumption${count === 1 ? '' : 's'}.`;
  const pruned = stake.label.prunedCount ? ` (${stake.label.prunedCount} pruned)` : '';
  return `Rests on ${count} so far, with more beyond what has been explored${pruned}.`;
}

export function CardAltitude({
  graph,
  edits,
  contracts,
}: {
  readonly graph: ProactivityGraph;
  readonly edits: ProactivityEdits;
  readonly contracts: readonly EffectContract[];
}) {
  const sources = sourcesOf(graph.nodes);
  const stakes = stakesOf(graph.nodes);
  const programs = groupPrograms(graph.nodes);
  const [openStake, setOpenStake] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 p-6" data-altitude="card">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-wide text-ij-ink-info">Sources</h3>
        <div className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <div
              key={source.id}
              data-node={source.id}
              className="flex items-center gap-2 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome px-3 py-2"
            >
              <KindChip kind="source" />
              <span className={source.disabled ? 'text-ij-ink-disabled' : 'text-ij-ink'}>{humanLifeKind(source.lifeKind)}</span>
              <span className="font-ij-mono text-xs text-ij-ink-info">{source.disabled ? 'off' : source.ingest}</span>
              <DisableControl node={source} edits={edits} />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wide text-ij-ink-info">What matters to you</h3>
        <div className="flex flex-wrap gap-4">
          {stakes.map((stake) => {
            const open = openStake === stake.id;
            return (
              <RepoCard
                key={stake.id}
                className={CARD_SIZE}
                dataNode={stake.id}
                dot="var(--ij-graph)"
                kind="Stake"
                kindTint="bg-ij-graph-tint"
                kindInk="text-ij-graph"
                title={stake.statement}
                badges={
                  <>
                    <DisabledTag disabled={stake.disabled} />
                    <DisableControl node={stake} edits={edits} />
                  </>
                }
              >
                <RepoCardDescription>{stakeSummary(stake)}</RepoCardDescription>
                <button
                  type="button"
                  className="self-start text-xs text-ij-link"
                  aria-expanded={open}
                  onClick={() => setOpenStake(open ? null : stake.id)}
                >
                  {open ? 'Hide what it rests on' : `See what it rests on (${stake.label.assumptionIds.length})`}
                </button>
                {open ? <AssumptionPanel graph={graph} stakeId={stake.id} edits={edits} /> : null}
              </RepoCard>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wide text-ij-ink-info">What it watches for you</h3>
        <div className="flex flex-wrap gap-4">
          {programs.map((program) => {
            const { watch, judgment, response } = program;
            const params = Object.keys(watch.conditionParams);
            return (
              <RepoCard
                key={program.id}
                className={CARD_SIZE}
                dot="var(--ij-agent)"
                kind="Watch"
                kindTint="bg-ij-agent-tint"
                kindInk="text-ij-agent"
                title={watch.statement}
                badges={
                  <>
                    <AuthorTag author={watch.author} />
                    <DisableControl node={watch} edits={edits} />
                  </>
                }
              >
                {program.stake ? <p className="text-xs text-ij-ink-info">For: {program.stake.statement}</p> : null}
                <p className="text-sm text-ij-ink">Looks for: {watch.condition}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <SourcesEditor watch={watch} allSources={sources} edits={edits} />
                  {params.map((param) => (
                    <NumberParamEditor key={param} watch={watch} param={param} edits={edits} />
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-ij-divider pt-2">
                  <KindChip kind="judgment" />
                  <JudgmentClassEditor judgment={judgment} edits={edits} />
                  <DisableControl node={judgment} edits={edits} />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-ij-divider pt-2">
                  <KindChip kind="response" />
                  <ActionClassEditor response={response} contracts={contracts} edits={edits} />
                  <DisableControl node={response} edits={edits} />
                  <PermissionBadge response={response} />
                  <BudgetBadge response={response} />
                </div>

                <DegradedNote node={watch} />
                <DegradedNote node={judgment} />
                <DegradedNote node={response} />
              </RepoCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
