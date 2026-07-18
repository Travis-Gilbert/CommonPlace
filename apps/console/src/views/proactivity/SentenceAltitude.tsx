'use client';

// SOURCING: none. The sentence altitude (PG3), the default entry: one object
// read as sentences a non-technical reader understands (named choice 5). It
// imports no graph library, so the list renders with the graph bundle absent
// (PG3 acceptance). The sentence is decompiled from the nodes; its number,
// interruption, and action tokens are inline-editable, so editing the sentence
// edits the same object the card and graph edit, and the round trip is stable
// (PG7 gate 6). Sources and assumptions are edited at the card altitude on the
// same nodes.

import { useState } from 'react';
import type { BlockHost } from '@commonplace/block-view/types';
import type { EffectContract, JudgmentClass, ProactivityGraph, ProjectedNode } from '@/lib/proactivity/model';
import { decompileGraph, type SentenceToken } from '@/lib/proactivity/sentences';
import {
  setActionClassAction,
  setConditionParamsAction,
  setJudgmentClassAction,
} from '@/lib/proactivity/node-actions';
import { AuthorTag, DegradedNote, DisableControl, DisabledTag } from './controls';
import { AssumptionPanel } from './AssumptionPanel';
import { humanClass } from './kinds';
import type { ProactivityEdits } from './use-edits';

const INLINE = 'rounded-ij-arc border border-ij-control-border bg-ij-editor px-1 text-xs text-ij-ink font-ij-ui';

function nodeById(graph: ProactivityGraph, id: string): ProjectedNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

function InlineNumber({
  graph,
  nodeId,
  param,
  text,
  edits,
}: {
  readonly graph: ProactivityGraph;
  readonly nodeId: string;
  readonly param: string;
  readonly text: string;
  readonly edits: ProactivityEdits;
}) {
  const node = nodeById(graph, nodeId);
  if (!node || node.kind !== 'watch') return <span>{text}</span>;
  return (
    <input
      type="number"
      min={0}
      aria-label={param}
      className={`${INLINE} w-12 font-ij-mono`}
      value={Number(node.conditionParams[param] ?? 0)}
      disabled={node.disabled}
      onChange={(event) => {
        const value = Number(event.target.value);
        if (Number.isNaN(value)) return;
        void edits.run({
          action: setConditionParamsAction(node.id, { ...node.conditionParams, [param]: value }),
          inverse: setConditionParamsAction(node.id, node.conditionParams),
          label: `change ${param}`,
        });
      }}
    />
  );
}

function InlineJudgment({
  graph,
  nodeId,
  edits,
}: {
  readonly graph: ProactivityGraph;
  readonly nodeId: string;
  readonly edits: ProactivityEdits;
}) {
  const node = nodeById(graph, nodeId);
  if (!node || node.kind !== 'judgment') return null;
  return (
    <select
      aria-label="when it fires"
      className={INLINE}
      value={node.judgmentClass}
      disabled={node.disabled}
      onChange={(event) => {
        const next = event.target.value as JudgmentClass;
        void edits.run({
          action: setJudgmentClassAction(node.id, next),
          inverse: setJudgmentClassAction(node.id, node.judgmentClass),
          label: 'change interruption',
        });
      }}
    >
      {(['interrupt', 'digest', 'silent'] as const).map((option) => (
        <option key={option} value={option}>
          {humanClass(option).toLowerCase()}
        </option>
      ))}
    </select>
  );
}

function InlineAction({
  graph,
  nodeId,
  contracts,
  edits,
}: {
  readonly graph: ProactivityGraph;
  readonly nodeId: string;
  readonly contracts: readonly EffectContract[];
  readonly edits: ProactivityEdits;
}) {
  const node = nodeById(graph, nodeId);
  if (!node || node.kind !== 'response') return null;
  return (
    <select
      aria-label="what it does"
      className={INLINE}
      value={node.actionClass}
      disabled={node.disabled}
      onChange={(event) => {
        const next = event.target.value;
        void edits.run({
          action: setActionClassAction(node.id, next),
          inverse: setActionClassAction(node.id, node.actionClass),
          label: 'change action',
        });
      }}
    >
      {contracts.map((contract) => (
        <option key={contract.id} value={contract.actionClass}>
          {contract.title.toLowerCase()}
        </option>
      ))}
    </select>
  );
}

function TokenView({
  token,
  graph,
  contracts,
  edits,
}: {
  readonly token: SentenceToken;
  readonly graph: ProactivityGraph;
  readonly contracts: readonly EffectContract[];
  readonly edits: ProactivityEdits;
}) {
  if (token.kind === 'text') return <span>{token.text}</span>;
  switch (token.editable.control) {
    case 'number':
      return <InlineNumber graph={graph} nodeId={token.nodeId} param={token.editable.param} text={token.text} edits={edits} />;
    case 'judgmentClass':
      return <InlineJudgment graph={graph} nodeId={token.nodeId} edits={edits} />;
    case 'actionClass':
      return <InlineAction graph={graph} nodeId={token.nodeId} contracts={contracts} edits={edits} />;
    default:
      // Sources render as text here; they are edited at the card altitude on
      // the same node.
      return <span className="underline decoration-dotted underline-offset-2">{token.text}</span>;
  }
}

export function SentenceAltitude({
  graph,
  host,
  edits,
  contracts,
}: {
  readonly graph: ProactivityGraph;
  readonly host: BlockHost;
  readonly edits: ProactivityEdits;
  readonly contracts: readonly EffectContract[];
}) {
  const doc = decompileGraph(graph);
  const [openStake, setOpenStake] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 p-6" data-altitude="sentence">
      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wide text-ij-ink-info">What matters to you</h3>
        {doc.stakes.map((line) => {
          const stakeNode = nodeById(graph, line.stakeId);
          const open = openStake === line.stakeId;
          return (
            <div key={line.id} className="rounded-ij-arc border border-ij-seam-raised bg-ij-editor p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-ij-ink">
                  {line.text} <span className="text-ij-ink-info">{line.assumptionSummary}</span>
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  {stakeNode && stakeNode.kind === 'stake' ? (
                    <>
                      <DisabledTag disabled={stakeNode.disabled} />
                      <DisableControl node={stakeNode} edits={edits} />
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-ij-link"
                aria-expanded={open}
                onClick={() => setOpenStake(open ? null : line.stakeId)}
              >
                {open ? 'Hide what it rests on' : 'See what it rests on'}
              </button>
              {open ? <AssumptionPanel graph={graph} stakeId={line.stakeId} edits={edits} /> : null}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wide text-ij-ink-info">What it watches for you</h3>
        {doc.programs.map((line) => {
          const watchNode = graph.nodes.find((node) => line.nodeIds.includes(node.id) && node.kind === 'watch');
          return (
            <div key={line.id} className="rounded-ij-arc border border-ij-seam-raised bg-ij-editor p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="leading-relaxed text-ij-ink">
                  {line.tokens.map((token, index) => (
                    <TokenView key={index} token={token} graph={graph} contracts={contracts} edits={edits} />
                  ))}
                  {line.note ? <span className="ml-1 text-ij-ink-info">({line.note})</span> : null}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <AuthorTag author={line.author} />
                  {watchNode && watchNode.kind === 'watch' ? <DisableControl node={watchNode} edits={edits} /> : null}
                </div>
              </div>
              {line.nodeIds
                .map((id) => nodeById(graph, id))
                .filter((node): node is ProjectedNode => Boolean(node))
                .map((node) => (
                  <DegradedNote key={`deg-${node.id}`} node={node} />
                ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
