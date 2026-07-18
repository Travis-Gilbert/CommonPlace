'use client';

// SOURCING: elkjs (via graph-layout.ts). The graph altitude (PG3): the join is
// a zoom of the same object, not a separate feature. The layered layout makes
// the two-sided convergence visible (named choice 8); elk runs asynchronously,
// so the layout step shows loading through the wait ladder. Selecting a node
// opens an inspector that reuses the same editors and disable the card uses, so
// editing here edits the same object (named choice 5). The graph is still: no
// ambient motion (the register rule), and the reduced-motion pass is identical
// because nothing animates.

import { useEffect, useMemo, useState } from 'react';
import { isDisableable, nodeDisabled, type EffectContract, type ProactivityGraph, type ProjectedNode } from '@/lib/proactivity/model';
import { ViewState } from '../ViewStates';
import { GraphCanvas } from './GraphCanvas';
import { layoutGraph, type GraphLayout } from './graph-layout';
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
import { humanLifeKind, sourcesOf } from './kinds';
import type { ProactivityEdits } from './use-edits';

function structuralSignature(graph: ProactivityGraph): string {
  return `${graph.nodes.map((node) => node.id).join(',')}|${graph.edges.length}`;
}

export function GraphAltitude({
  graph,
  edits,
  contracts,
}: {
  readonly graph: ProactivityGraph;
  readonly edits: ProactivityEdits;
  readonly contracts: readonly EffectContract[];
}) {
  const [laid, setLaid] = useState<{ layout: GraphLayout; sig: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const signature = useMemo(() => structuralSignature(graph), [graph]);

  useEffect(() => {
    let live = true;
    const sig = signature;
    // State transitions happen in the async resolution, not synchronously in
    // the effect body: a stale layout stays visible during a re-layout rather
    // than flashing loading, and a recovered layout clears the failure.
    layoutGraph(graph)
      .then((next) => {
        if (live) {
          setLaid({ layout: next, sig });
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
    // Re-layout only when topology changes, not on every parameter edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const selected = selectedId ? graph.nodes.find((node) => node.id === selectedId) ?? null : null;

  if (failed) return <ViewState state="error" errorMessage="The graph could not be laid out." />;
  if (!laid) return <ViewState state="loading" />;
  // The partial state: the structure changed (an intent was committed) and the
  // layered layout is being recomputed. The stale graph shows dimmed, not blank.
  const stale = laid.sig !== signature;
  const layout = laid.layout;

  return (
    <div className="flex h-full flex-col" data-altitude="graph">
      <p className="border-b border-ij-divider px-6 py-2 text-xs text-ij-ink-info">
        Facts arrive from your sources on one side; your stakes rest on assumptions on the other. A watch fires only where
        both converge (the marked joins).
      </p>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto p-6">
          <ViewState state={stale ? 'stale' : 'populated'}>
            <GraphCanvas layout={layout} selectedId={selectedId} onSelect={setSelectedId} />
          </ViewState>
        </div>
        <aside className="w-rec-side-panel shrink-0 overflow-auto border-l border-ij-divider bg-ij-chrome p-4">
          {selected ? (
            <NodeInspector node={selected} graph={graph} edits={edits} contracts={contracts} />
          ) : (
            <p className="text-sm text-ij-ink-info">Select a node to inspect and edit it.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function NodeInspector({
  node,
  graph,
  edits,
  contracts,
}: {
  readonly node: ProjectedNode;
  readonly graph: ProactivityGraph;
  readonly edits: ProactivityEdits;
  readonly contracts: readonly EffectContract[];
}) {
  const sources = sourcesOf(graph.nodes);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KindChip kind={node.kind} />
          {'author' in node ? <AuthorTag author={node.author} /> : null}
          <DisabledTag disabled={nodeDisabled(node)} />
        </div>
        {isDisableable(node) ? <DisableControl node={node} edits={edits} /> : null}
      </div>

      {node.kind === 'source' ? (
        <p className="text-sm text-ij-ink">
          {humanLifeKind(node.lifeKind)} ingest: <span className="font-ij-mono text-ij-ink-info">{node.disabled ? 'off' : node.ingest}</span>
        </p>
      ) : null}

      {node.kind === 'stake' ? (
        <>
          <p className="text-sm text-ij-ink">{node.statement}</p>
          <AssumptionPanel graph={graph} stakeId={node.id} edits={edits} />
        </>
      ) : null}

      {node.kind === 'assumption' ? (
        <AssumptionPanel graph={graph} stakeId={node.stakeId} edits={edits} />
      ) : null}

      {node.kind === 'watch' ? (
        <>
          <p className="text-sm text-ij-ink">{node.statement}</p>
          <p className="text-xs text-ij-ink-info">Looks for: {node.condition}</p>
          <SourcesEditor watch={node} allSources={sources} edits={edits} />
          {Object.keys(node.conditionParams).map((param) => (
            <NumberParamEditor key={param} watch={node} param={param} edits={edits} />
          ))}
          <DegradedNote node={node} />
        </>
      ) : null}

      {node.kind === 'judgment' ? (
        <>
          <JudgmentClassEditor judgment={node} edits={edits} />
          <DegradedNote node={node} />
        </>
      ) : null}

      {node.kind === 'response' ? (
        <>
          <ActionClassEditor response={node} contracts={contracts} edits={edits} />
          <div className="flex flex-wrap items-center gap-2">
            <PermissionBadge response={node} />
            <BudgetBadge response={node} />
          </div>
          <DegradedNote node={node} />
        </>
      ) : null}
    </div>
  );
}
