'use client';

// SOURCING: jalco-ui `@jalco/repo-card` (adopted, components/repo-card.tsx).
// Every card on this altitude IS that component: the variant matrix, the slot
// anatomy, and the meta-row order are upstream's, and this file only decides
// which proactivity fact rides which slot. No card is hand-rolled here.

/**
 * The card altitude, in repo-card grammar
 * (31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE P3, named choice 5).
 *
 * A stake IS the repository. That is the whole conceit, and it holds slot by
 * slot: a repository is a thing you care about, with a description, topics, a
 * language, activity counts, a license bounding what may be done with it, and a
 * last-touched time. A stake is a thing you care about, with an assumption
 * frontier, source topics, an author, firing counts, a budget bounding what may
 * be spent on it, and a last-fired time. The mapping is not a costume; the two
 * objects have the same shape.
 *
 * Below each stake, its programs render as compact rows in the same grammar
 * (upstream's `sm` size and `ghost` variant), so a watch, its judgment, and its
 * response read as parts of one repository rather than as three unrelated
 * widgets. Every control is the same one the graph inspector uses, so the
 * altitudes cannot drift.
 */

import { useState } from 'react';
import type { EffectContract, ProactivityGraph, ProjectedResponse, StakeNode } from '@/lib/proactivity/model';
import { RepoCard, formatCount, formatRelativeDate, type RepoCardData, type RepoCardStat } from '@/components/repo-card';
import { laneColor } from '@/components/commit-graph';
import {
  ActionClassEditor,
  AuthorTag,
  BudgetBadge,
  DegradedNote,
  DisableControl,
  JudgmentClassEditor,
  NumberParamEditor,
  PermissionBadge,
  SourcesEditor,
} from './controls';
import { AssumptionPanel } from './AssumptionPanel';
import { laneOf, spendChip } from './commits';
import { bodyFontClass, groupPrograms, humanLifeKind, sourcesOf, stakesOf, titleFontClass, type ProgramView } from './kinds';
import { speakerOf } from './typography';
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

/** The permission clause, in the accent grammar (named choice 7): over budget
 *  refuses, a grant is learned, no grant asks every time. This is the same
 *  sentence `PermissionBadge` renders; here it rides the card's updated slot,
 *  which is where a repository puts "last touched" and a program puts "how it
 *  is allowed to touch you". */
function permissionMeta(response: ProjectedResponse): { text: string; tone: RepoCardData['updatedTone'] } {
  if (response.budget.overBudget) return { text: 'over budget, not running', tone: 'error' };
  if (response.permission.hasGrant) {
    const expiry = response.permission.expiresOn ? `, expires ${response.permission.expiresOn}` : '';
    return { text: `can act on its own${expiry}`, tone: 'gold' };
  }
  return { text: 'will ask you every time', tone: 'accent' };
}

/** The star and fork slots: how often this program has fired, and when it last
 *  did. A program that has never fired says so rather than showing a zero with
 *  no context. */
function firingStats(response: ProjectedResponse): readonly RepoCardStat[] {
  const { firing } = response;
  if (firing.count === 0) return [{ label: 'never fired', value: '' }];
  return [
    { label: 'fired', value: formatCount(firing.count) },
    { label: 'last', value: firing.lastFiredOn ? formatRelativeDate(firing.lastFiredOn) : 'unknown' },
  ];
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

  /** Which sources could change what a stake rests on: the stake's topics. */
  const topicsForStake = (stakeId: string): string[] => {
    const ids = new Set<string>();
    for (const node of graph.nodes) {
      if (node.kind !== 'assumption' || node.stakeId !== stakeId) continue;
      for (const sourceId of node.couldChangeSourceIds) ids.add(sourceId);
    }
    return sources.filter((source) => ids.has(source.id)).map((source) => humanLifeKind(source.lifeKind));
  };

  /** A stake's activity is the activity of the programs protecting it. */
  const programsForStake = (stakeId: string): ProgramView[] =>
    programs.filter((program) => program.stake?.id === stakeId);

  return (
    <div className="flex flex-col gap-6 p-6" data-altitude="card">
      <section className="flex flex-col gap-2">
        <h3 className="font-ij-mono text-xs uppercase tracking-wide text-ij-ink-info" data-type-role="machine">
          Sources
        </h3>
        <div className="flex flex-wrap gap-2">
          {sources.map((source) => (
            // A source is a compact row in the same grammar: upstream's `sm`
            // size and `outline` variant, with the ingest state in the meta row
            // where a repository puts its language.
            <RepoCard
              key={source.id}
              size="sm"
              variant="outline"
              data-node={source.id}
              className="w-auto"
              titleClass={titleFontClass(source)}
              bodyClass={bodyFontClass(source)}
              speaker={speakerOf(undefined)}
              showTopics={false}
              showLicense={false}
              data={{
                name: humanLifeKind(source.lifeKind),
                laneInk: laneColor(laneOf(source)),
                stats: [{ label: source.disabled ? 'off' : source.ingest, value: '' }],
                archived: source.disabled,
                archivedLabel: 'Off',
              }}
              badges={<DisableControl node={source} edits={edits} />}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-ij-mono text-xs uppercase tracking-wide text-ij-ink-info" data-type-role="machine">
          What matters to you
        </h3>
        <div className="flex flex-wrap gap-4">
          {stakes.map((stake) => {
            const open = openStake === stake.id;
            const mine = programsForStake(stake.id);
            const response = mine[0]?.response;
            const permission = response ? permissionMeta(response) : undefined;
            return (
              <RepoCard
                key={stake.id}
                data-node={stake.id}
                className={`${CARD_SIZE} ${bodyFontClass(stake)}`}
                titleClass={titleFontClass(stake)}
                bodyClass={bodyFontClass(stake)}
                speaker={speakerOf(stake)}
                size="lg"
                data={{
                  name: stake.statement,
                  description: stakeSummary(stake),
                  topics: topicsForStake(stake.id),
                  laneInk: laneColor(laneOf(stake)),
                  laneLabel: stake.author === 'human' ? 'yours' : 'agent',
                  stats: response ? firingStats(response) : [],
                  license: response ? spendChip(response) : undefined,
                  licenseTone: response?.budget.overBudget ? 'error' : 'info',
                  updated: permission?.text,
                  updatedTone: permission?.tone,
                  archived: stake.disabled,
                }}
                badges={<DisableControl node={stake} edits={edits} />}
              >
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
        <h3 className="font-ij-mono text-xs uppercase tracking-wide text-ij-ink-info" data-type-role="machine">
          What it watches for you
        </h3>
        <div className="flex flex-wrap gap-4">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              graph={graph}
              edits={edits}
              contracts={contracts}
              allSources={sources}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * One standing program as a repository card, with its judgment and response as
 * compact rows in the same grammar beneath it. The response is where every
 * boundary lives, so it carries the permission clause, the spend, and the
 * degraded consequence: nothing about what the agent may do is stated anywhere
 * except on the commit that would do it.
 */
function ProgramCard({
  program,
  graph,
  edits,
  contracts,
  allSources,
}: {
  readonly program: ProgramView;
  readonly graph: ProactivityGraph;
  readonly edits: ProactivityEdits;
  readonly contracts: readonly EffectContract[];
  readonly allSources: ReturnType<typeof sourcesOf>;
}) {
  const { watch, judgment, response } = program;
  const params = Object.keys(watch.conditionParams);
  const permission = permissionMeta(response);
  const topics = watch.sourceIds
    .map((id) => graph.nodes.find((node) => node.id === id))
    .filter((node): node is Extract<typeof node, { kind: 'source' }> => node?.kind === 'source')
    .map((source) => humanLifeKind(source.lifeKind));

  return (
    <RepoCard
      data-node={watch.id}
      className={`${CARD_SIZE} ${bodyFontClass(watch)}`}
      titleClass={titleFontClass(watch)}
      bodyClass={bodyFontClass(watch)}
      speaker={speakerOf(watch)}
      size="lg"
      data={{
        name: watch.statement,
        description: program.stake ? `For: ${program.stake.statement}` : 'A standing query, protecting no one stake.',
        topics,
        laneInk: laneColor(laneOf(watch)),
        laneLabel: watch.author === 'human' ? 'yours' : 'agent',
        stats: firingStats(response),
        license: spendChip(response),
        licenseTone: response.budget.overBudget ? 'error' : 'info',
        updated: permission.text,
        updatedTone: permission.tone,
        archived: watch.disabled,
        // Upstream's fork badge, for the watch that was not authored but fell
        // out of a stake's label: derived lineage, exactly what a fork is.
        fork: watch.subKind === 'derived',
      }}
      badges={
        <>
          <AuthorTag author={watch.author} />
          <DisableControl node={watch} edits={edits} />
        </>
      }
    >
      <p
        className={`text-sm text-ij-ink ${bodyFontClass(watch)}`}
        data-type-role="body"
        data-type-speaker={speakerOf(watch)}
      >
        Looks for: {watch.condition}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <SourcesEditor watch={watch} allSources={allSources} edits={edits} />
        {params.map((param) => (
          <NumberParamEditor key={param} watch={watch} param={param} edits={edits} />
        ))}
      </div>

      <RepoCard
        size="sm"
        variant="ghost"
        data-node={judgment.id}
        className="border-t border-ij-divider"
        titleClass={titleFontClass(judgment)}
        bodyClass={bodyFontClass(judgment)}
        speaker={speakerOf(judgment)}
        showTopics={false}
        showLicense={false}
        showUpdated={false}
        data={{ name: 'When it fires', laneInk: laneColor(laneOf(judgment)), archived: judgment.disabled }}
        badges={<DisableControl node={judgment} edits={edits} />}
      >
        <JudgmentClassEditor judgment={judgment} edits={edits} />
      </RepoCard>

      <RepoCard
        size="sm"
        variant="ghost"
        data-node={response.id}
        className="border-t border-ij-divider"
        titleClass={titleFontClass(response)}
        bodyClass={bodyFontClass(response)}
        speaker={speakerOf(response)}
        showTopics={false}
        data={{
          name: 'What it does',
          laneInk: laneColor(laneOf(response)),
          license: spendChip(response),
          licenseTone: response.budget.overBudget ? 'error' : 'info',
          updated: permission.text,
          updatedTone: permission.tone,
          archived: response.disabled,
        }}
        badges={<DisableControl node={response} edits={edits} />}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ActionClassEditor response={response} contracts={contracts} edits={edits} />
          <PermissionBadge response={response} />
          <BudgetBadge response={response} />
        </div>
      </RepoCard>

      <DegradedNote node={watch} />
      <DegradedNote node={judgment} />
      <DegradedNote node={response} />
    </RepoCard>
  );
}
