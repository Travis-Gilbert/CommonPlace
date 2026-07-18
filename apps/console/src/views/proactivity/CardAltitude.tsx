'use client';

// SOURCING: none. The card altitude (PG3), the full edit surface (PG4): one
// object read as cards. Sources carry disable so turning one off shows its
// dependent watches degrade with the consequence named (PG2, named choice 2).
// Each program card edits the safe surface area (sources, condition params,
// interruption class, action class) and carries disable on every node and the
// permission and budget on the response (named choice 7). Stakes expand to
// their assumptions (PG6). Every control is the same one the sentence uses, so
// the altitudes cannot drift.

import { useState } from 'react';
import type { EffectContract, ProactivityGraph } from '@/lib/proactivity/model';
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
import type { ProactivityEdits } from './use-edits';

const CARD = 'rounded-ij-arc border border-ij-seam-raised bg-ij-editor p-3 flex flex-col gap-2';

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
            <div key={source.id} data-node={source.id} className="flex items-center gap-2 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome px-3 py-2">
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
        {stakes.map((stake) => {
          const open = openStake === stake.id;
          return (
            <div key={stake.id} className={CARD}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KindChip kind="stake" />
                  <span className="text-ij-ink">{stake.statement}</span>
                  <DisabledTag disabled={stake.disabled} />
                </div>
                <DisableControl node={stake} edits={edits} />
              </div>
              <button
                type="button"
                className="text-left text-xs text-ij-link"
                aria-expanded={open}
                onClick={() => setOpenStake(open ? null : stake.id)}
              >
                {open ? 'Hide what it rests on' : `See what it rests on (${stake.label.assumptionIds.length})`}
              </button>
              {open ? <AssumptionPanel graph={graph} stakeId={stake.id} edits={edits} /> : null}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wide text-ij-ink-info">What it watches for you</h3>
        {programs.map((program) => {
          const { watch, judgment, response } = program;
          const params = Object.keys(watch.conditionParams);
          return (
            <article key={program.id} className={CARD}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KindChip kind="watch" />
                  <span className="text-ij-ink">{watch.statement}</span>
                  <AuthorTag author={watch.author} />
                  <DisabledTag disabled={watch.disabled} />
                </div>
                <DisableControl node={watch} edits={edits} />
              </div>
              {program.stake ? <p className="text-xs text-ij-ink-info">For your stake: {program.stake.statement}</p> : null}

              <p className="text-sm text-ij-ink">Looks for: {watch.condition}</p>
              <div className="flex flex-wrap items-center gap-3">
                <SourcesEditor watch={watch} allSources={sources} edits={edits} />
                {params.map((param) => (
                  <NumberParamEditor key={param} watch={watch} param={param} edits={edits} />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-ij-divider pt-2">
                <div className="flex items-center gap-2">
                  <KindChip kind="judgment" />
                  <JudgmentClassEditor judgment={judgment} edits={edits} />
                  <DisableControl node={judgment} edits={edits} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-ij-divider pt-2">
                <div className="flex items-center gap-2">
                  <KindChip kind="response" />
                  <ActionClassEditor response={response} contracts={contracts} edits={edits} />
                  <DisableControl node={response} edits={edits} />
                </div>
                <PermissionBadge response={response} />
                <BudgetBadge response={response} />
              </div>

              <DegradedNote node={watch} />
              <DegradedNote node={judgment} />
              <DegradedNote node={response} />
            </article>
          );
        })}
      </section>
    </div>
  );
}
