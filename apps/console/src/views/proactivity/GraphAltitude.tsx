'use client';

// SOURCING: elk (layout) + @xyflow/react via GraphCanvas. The graph altitude
// (PG3): the join is a zoom of the same object, not a separate feature. elk runs
// asynchronously, so the layout step shows loading through the wait ladder.
// Selecting a node opens an inspector that reuses the same editors the card
// uses, so editing here edits the same object (named choice 5). The graph is
// still: no ambient motion (the register rule), and the reduced-motion pass is
// identical because nothing animates.

import { useEffect, useMemo, useState } from 'react';
import { isDisableable, nodeDisabled, type EffectContract, type ProactivityGraph, type ProjectedNode } from '@/lib/proactivity/model';
import { ViewState } from '../ViewStates';
import { GraphCanvas } from './GraphCanvas';
import { layoutGraph, responseStepCount, type GraphLayout } from './graph-layout';
import {
  AuthorTag,
  BudgetBadge,
  DegradedNote,
  DisableControl,
  DisabledTag,
  KindChip,
  PermissionBadge,
} from './controls';
import { AssumptionPanel } from './AssumptionPanel';
import { BlockStack } from './BlockStack';
import { bodyFontClass, humanLifeKind, sourcesOf } from './kinds';
import type { ProactivityEdits } from './use-edits';

function structuralSignature(graph: ProactivityGraph): string {
  // Includes each response's step count: stacking a step changes the node
  // height, so elk must re-run to reflow the layout around the taller node.
  const nodes = graph.nodes
    .map((node) => (node.kind === 'response' ? `${node.id}:${responseStepCount(node)}` : node.id))
    .join(',');
  return `${nodes}|${graph.edges.length}`;
}

export function GraphAltitude({
  graph,
  edits,
  contracts,
  onCompile,
}: {
  readonly graph: ProactivityGraph;
  readonly edits: ProactivityEdits;
  readonly contracts: readonly EffectContract[];
  readonly onCompile?: (hint: string) => void;
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

  // Keep elk's geometry (recomputed only when topology changes) but always
  // render the current node state: a non-topology edit (disable, action class,
  // params) updates the projection without moving anything, so overlay the live
  // ProjectedNode onto each cached node so the canvas never shows stale disabled,
  // degraded, permission, or budget state (PG7 altitude coherence).
  const currentById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const layout = useMemo<GraphLayout | null>(() => {
    if (!laid) return null;
    return {
      ...laid.layout,
      nodes: laid.layout.nodes.map((rfNode) => {
        const current = currentById.get(rfNode.id);
        return current ? { ...rfNode, data: { ...rfNode.data, node: current } } : rfNode;
      }),
    };
  }, [laid, currentById]);

  const selected = selectedId ? graph.nodes.find((node) => node.id === selectedId) ?? null : null;

  if (failed) return <ViewState state="error" errorMessage="The graph could not be laid out." />;
  if (!laid || !layout) return <ViewState state="loading" />;
  // The partial state: the structure changed (an intent was committed) and the
  // layered layout is being recomputed. The current graph stays on screen.
  const stale = laid.sig !== signature;

  return (
    <div className="flex h-full flex-col" data-altitude="graph">
      <p className="border-b border-ij-divider px-6 py-2 text-xs text-ij-ink-info">
        Facts arrive from your sources on one side; your stakes rest on assumptions on the other. A watch fires only where
        both converge (the marked joins).
      </p>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <GraphCanvas layout={layout} selectedId={selectedId} edits={edits} onSelect={setSelectedId} onCompile={onCompile} />
          {stale ? (
            <div className="absolute left-4 top-4 rounded-ij-arc bg-ij-chrome px-2 py-1 text-xs text-ij-ink-info">
              Updating layout…
            </div>
          ) : null}
        </div>
        {selected ? (
          <aside className="w-rec-side-panel shrink-0 overflow-auto border-l border-ij-divider bg-ij-chrome p-4">
            <NodeInspector node={selected} graph={graph} edits={edits} contracts={contracts} onCompile={onCompile} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function NodeInspector({
  node,
  graph,
  edits,
  contracts,
  onCompile,
}: {
  readonly node: ProjectedNode;
  readonly graph: ProactivityGraph;
  readonly edits: ProactivityEdits;
  readonly contracts: readonly EffectContract[];
  readonly onCompile?: (hint: string) => void;
}) {
  const sources = sourcesOf(graph.nodes);
  return (
    <div className={`flex flex-col gap-3 ${bodyFontClass(node)}`}>
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
          <p className="text-sm text-ij-ink font-cp-title">{node.statement}</p>
          <BlockStack node={node} sources={sources} contracts={contracts} edits={edits} onCompile={onCompile} />
          <AssumptionPanel graph={graph} stakeId={node.id} edits={edits} />
        </>
      ) : null}

      {node.kind === 'assumption' ? (
        <AssumptionPanel graph={graph} stakeId={node.stakeId} edits={edits} />
      ) : null}

      {node.kind === 'watch' ? (
        <>
          <p className="text-sm text-ij-ink font-cp-title">{node.statement}</p>
          <p className="text-xs text-ij-ink-info">Looks for: {node.condition}</p>
          <BlockStack node={node} sources={sources} contracts={contracts} edits={edits} onCompile={onCompile} />
          <DegradedNote node={node} />
        </>
      ) : null}

      {node.kind === 'judgment' ? (
        <>
          <BlockStack node={node} sources={sources} contracts={contracts} edits={edits} onCompile={onCompile} />
          <DegradedNote node={node} />
        </>
      ) : null}

      {node.kind === 'response' ? (
        <>
          <BlockStack node={node} sources={sources} contracts={contracts} edits={edits} onCompile={onCompile} />
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
