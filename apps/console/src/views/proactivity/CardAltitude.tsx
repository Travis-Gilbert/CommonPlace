'use client';

// SOURCING: jalco-ui `@jalco/repo-card` (adopted, components/repo-card.tsx) for
// every card; the Int UI panel and Twenty metrics through views/proactivity/board.tsx.
// No card and no panel on this altitude is hand-rolled.

/**
 * The card altitude, bounded and dense
 * (32-HANDOFF-PROACTIVITY-MATERIAL-AND-DENSITY Q1 through Q5, on the mapping
 * 31 named choice 5 established).
 *
 * A stake IS the repository, slot for slot. What 32 corrects is that the
 * mapping arrived as a skeleton: the slots were filled with text where the
 * reference card has anchors, the sections floated as mono labels over an
 * unbounded page, and authorship shipped as a colored word instead of a shape.
 *
 * So, in order of what a reader hits first:
 * - Three panels with header strips bound the surface (Q1). Nothing floats.
 * - Every card leads with a kind tile carrying the author's rail (Q3), which is
 *   what makes authorship survive grayscale: the rail's position and the
 *   title's face, neither of them a hue.
 * - Every state phrase is a badge and the budget is a meter (Q3). The stat run
 *   carries ink and info grays only; the semantic color on this surface lives
 *   in shapes.
 * - One button per card face; Disable moved into the overflow (Q3), which is
 *   what takes six identical buttons down to none on the face.
 * - Sources are one panel of switch rows, not five boxes with five buttons (Q4).
 * - The compile affordance is bounded and labelled, seated in the watches
 *   panel's header region (Q5).
 */

import { useState } from 'react';
import type {
  EffectContract,
  ProactivityGraph,
  ProjectedResponse,
  StakeNode,
} from '@/lib/proactivity/model';
import { RepoCard, formatCount, formatRelativeDate, type RepoCardStat } from '@/components/repo-card';
import { laneColor } from '@/components/commit-graph';
import {
  ActionClassEditor,
  DegradedNote,
  JudgmentClassEditor,
  NumberParamEditor,
  SourcesEditor,
} from './controls';
import { setDisabledAction } from '@/lib/proactivity/node-actions';
import { AssumptionPanel } from './AssumptionPanel';
import { laneOf, spendChip } from './commits';
import {
  ClockMark,
  FiredSparkline,
  KindTile,
  OverflowItem,
  OverflowMenu,
  Panel,
  SourceRow,
  SpendMeter,
  StateBadge,
  type BadgeTone,
} from './board';
import { bodyFontClass, groupPrograms, humanLifeKind, sourcesOf, stakesOf, titleFontClass, type ProgramView } from './kinds';
import { speakerOf } from './typography';
import type { ProactivityEdits } from './use-edits';
import type { BlockHost } from '@commonplace/block-view/types';
import { IntentComposer } from './IntentComposer';
import type { IntentCompileResult } from '@/lib/proactivity/forme';

// Twenty density: a card grows to fill a column but never past ~26rem, and the
// wrap gap is two grid units, not four. This is most of the "two thirds of the
// vertical space" the Q2 acceptance asks for; the rest is the padding and ramp
// changes inside the adopted card itself.
const CARD_SIZE = 'grow basis-80 max-w-md';

/** The stake's assumption frontier, honest about being bounded (PG6). */
function stakeSummary(stake: StakeNode): string {
  const count = stake.label.assumptionIds.length;
  if (stake.label.complete) return `Rests on ${count} assumption${count === 1 ? '' : 's'}.`;
  const pruned = stake.label.prunedCount ? ` (${stake.label.prunedCount} pruned)` : '';
  return `Rests on ${count} so far, with more beyond what has been explored${pruned}.`;
}

/**
 * The permission clause as a BADGE, not a colored sentence (named choice 4).
 * Over budget is amber, learned autonomy is gold, a pending ask is neutral: the
 * accent grammar intact, moved from type into shape.
 */
function permissionBadge(response: ProjectedResponse): { text: string; tone: BadgeTone } {
  if (response.budget.overBudget) return { text: 'over budget', tone: 'amber' };
  if (response.permission.hasGrant) return { text: 'acts on its own', tone: 'gold' };
  return { text: 'asks every time', tone: 'neutral' };
}

/**
 * The stat run: a sparkline with a count, a clock with the last firing, and the
 * budget as a meter. Three marks where three sentences used to be.
 */
function firingStats(response: ProjectedResponse): readonly RepoCardStat[] {
  const { firing, budget } = response;
  const spend: RepoCardStat = {
    label: spendChip(response),
    value: '',
    mark: <SpendMeter spent={budget.projectedSpend} cap={budget.cap} />,
  };
  if (firing.count === 0) return [{ label: 'never fired', value: '' }, spend];
  return [
    { label: formatCount(firing.count), value: '', mark: <FiredSparkline firedOn={firing.firedOn} /> },
    {
      label: firing.lastFiredOn ? formatRelativeDate(firing.lastFiredOn) : 'unknown',
      value: '',
      mark: <ClockMark />,
    },
    spend,
  ];
}

export function CardAltitude({
  graph,
  edits,
  contracts,
  host,
  compileHint,
  compilation,
  onCompilation,
}: {
  readonly graph: ProactivityGraph;
  readonly edits: ProactivityEdits;
  readonly contracts: readonly EffectContract[];
  readonly host: BlockHost;
  readonly compileHint?: string;
  readonly compilation: IntentCompileResult | null;
  readonly onCompilation: (result: IntentCompileResult | null) => void;
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

  const programsForStake = (stakeId: string): ProgramView[] =>
    programs.filter((program) => program.stake?.id === stakeId);

  const toggleSource = (source: { readonly id: string; readonly disabled: boolean }) =>
    void edits.run({
      action: setDisabledAction(source.id, !source.disabled),
      inverse: setDisabledAction(source.id, source.disabled),
      label: source.disabled ? `enable ${source.id}` : `disable ${source.id}`,
    });

  return (
    <div className="flex flex-col gap-2 p-3" data-altitude="card">
      {/* Q4. One panel, five rows, five switches. The box farm is gone: five
          identical Disable buttons down a row is what made this read as a
          settings form rather than an instrument. */}
      <Panel title="Sources" className="max-w-sm">
        {sources.map((source) => (
          <SourceRow
            key={source.id}
            id={source.id}
            name={humanLifeKind(source.lifeKind)}
            state={source.disabled ? 'off' : source.ingest}
            live={!source.disabled}
            onToggle={() => toggleSource(source)}
          />
        ))}
      </Panel>

      <Panel title="What matters to you">
        <div className="flex flex-wrap gap-2 p-2">
          {stakes.map((stake) => {
            const open = openStake === stake.id;
            const mine = programsForStake(stake.id);
            const response = mine[0]?.response;
            const permission = response ? permissionBadge(response) : undefined;
            return (
              <RepoCard
                key={stake.id}
                data-node={stake.id}
                className={`${CARD_SIZE} ${bodyFontClass(stake)}`}
                titleClass={titleFontClass(stake)}
                bodyClass={bodyFontClass(stake)}
                speaker={speakerOf(stake)}
                size="lg"
                leading={<KindTile kind="stake" laneInk={laneColor(laneOf(stake))} />}
                showLicense={false}
                showUpdated={false}
                data={{
                  name: stake.statement,
                  description: stakeSummary(stake),
                  topics: topicsForStake(stake.id),
                  stats: response ? firingStats(response) : [],
                  archived: stake.disabled,
                }}
                badges={permission ? <StateBadge tone={permission.tone}>{permission.text}</StateBadge> : null}
                action={
                  <>
                    <OverflowMenu label={`Actions for this stake`}>
                      <OverflowItem
                        onSelect={() =>
                          void edits.run({
                            action: setDisabledAction(stake.id, !stake.disabled),
                            inverse: setDisabledAction(stake.id, stake.disabled),
                            label: stake.disabled ? `enable ${stake.id}` : `disable ${stake.id}`,
                          })
                        }
                      >
                        {stake.disabled ? 'Enable this stake' : 'Disable this stake'}
                      </OverflowItem>
                    </OverflowMenu>
                  </>
                }
              >
                {/* The one button a card face is allowed to carry. */}
                <button
                  type="button"
                  className="self-start text-rec-body text-ij-link"
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
      </Panel>

      {/* Q5. The compiler is this panel's tool, so it sits in this panel's
          header region: bounded, labelled, and incapable of being mistaken for
          the Composer. */}
      <Panel
        title="What it watches for you"
        banner={
          <IntentComposer
            host={host}
            sources={sources}
            contracts={contracts}
            hint={compileHint}
            result={compilation}
            onResult={onCompilation}
          />
        }
      >
        <div className="flex flex-wrap gap-2 p-2">
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
      </Panel>
    </div>
  );
}

/**
 * One standing program. The watch is the card; its judgment and response are
 * compact rows in the same grammar beneath it. Every boundary lives on the
 * response, so it carries the permission badge and the spend meter: nothing
 * about what the agent may do is stated anywhere except on the thing that would
 * do it.
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
  const permission = permissionBadge(response);
  const topics = watch.sourceIds
    .map((id) => graph.nodes.find((node) => node.id === id))
    .filter((node): node is Extract<typeof node, { kind: 'source' }> => node?.kind === 'source')
    .map((source) => humanLifeKind(source.lifeKind));

  const disableItem = (node: { id: string; disabled: boolean }, noun: string) => (
    <OverflowItem
      onSelect={() =>
        void edits.run({
          action: setDisabledAction(node.id, !node.disabled),
          inverse: setDisabledAction(node.id, node.disabled),
          label: node.disabled ? `enable ${node.id}` : `disable ${node.id}`,
        })
      }
    >
      {node.disabled ? `Enable the ${noun}` : `Disable the ${noun}`}
    </OverflowItem>
  );

  return (
    <RepoCard
      data-node={watch.id}
      className={`${CARD_SIZE} ${bodyFontClass(watch)}`}
      titleClass={titleFontClass(watch)}
      bodyClass={bodyFontClass(watch)}
      speaker={speakerOf(watch)}
      size="lg"
      leading={<KindTile kind="watch" laneInk={laneColor(laneOf(watch))} />}
      showLicense={false}
      showUpdated={false}
      data={{
        name: watch.statement,
        description: program.stake ? `For: ${program.stake.statement}` : 'A standing query, protecting no one stake.',
        topics,
        stats: firingStats(response),
        archived: watch.disabled,
        // Upstream's fork badge for lineage that was derived, not authored.
        fork: watch.subKind === 'derived',
      }}
      badges={<StateBadge tone={permission.tone}>{permission.text}</StateBadge>}
      action={
        <>
          <OverflowMenu label="Actions for this program">
            {disableItem(watch, 'watch')}
            {disableItem(judgment, 'judgment')}
            {disableItem(response, 'response')}
          </OverflowMenu>
        </>
      }
    >
      <p
        className={`text-rec-body text-ij-ink ${bodyFontClass(watch)}`}
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

      <div className="flex flex-wrap items-center gap-2 border-t border-ij-divider pt-2" data-node={judgment.id}>
        <KindTile kind="judgment" laneInk={laneColor(laneOf(judgment))} size="sm" />
        <JudgmentClassEditor judgment={judgment} edits={edits} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-ij-divider pt-2" data-node={response.id}>
        <KindTile kind="response" laneInk={laneColor(laneOf(response))} size="sm" />
        <ActionClassEditor response={response} contracts={contracts} edits={edits} />
      </div>

      <DegradedNote node={watch} />
      <DegradedNote node={judgment} />
      <DegradedNote node={response} />
    </RepoCard>
  );
}
