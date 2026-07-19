'use client';

// SOURCING: @xyflow/react for the plan canvas, @dagrejs/dagre for materialized DAG
// layout, cmdk for the capability palette, and @dnd-kit/core for deferred
// affordance injection. Live state is the shared theorem-acp projection.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { Background, BackgroundVariant, Controls, ReactFlow, type EdgeTypes, type NodeTypes } from '@xyflow/react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import {
  planIsComplete,
  subscribePlanState,
  type PlanCapability,
  type PlanCanvasSnapshot,
  type PlanPollPayload,
  type PlanSubscriptionStatus,
} from '@commonplace/theorem-acp/plan-state';
import { layoutGoalPlan, type GoalFlowEdge, type GoalFlowNode } from './plan-layout';
import { ProgressEdge } from './ProgressEdge';
import { PlanTaskNode } from './PlanTaskNode';
import { ToolPalette } from './ToolPalette';
import { NodeInspector } from './NodeInspector';
import { PlanPermissionPrompt } from './PlanPermissionPrompt';

const NODE_TYPES: NodeTypes = { goalTask: PlanTaskNode };
const EDGE_TYPES: EdgeTypes = { goalProgress: ProgressEdge };

export function GoalStackView(_props: ViewRenderProps) {
  const [planInput, setPlanInput] = useState('');
  const [planId, setPlanId] = useState('');
  const [snapshot, setSnapshot] = useState<PlanCanvasSnapshot | null>(null);
  const [capabilities, setCapabilities] = useState<PlanCapability[]>([]);
  const [nodes, setNodes] = useState<GoalFlowNode[]>([]);
  const [edges, setEdges] = useState<GoalFlowEdge[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hideSuperseded, setHideSuperseded] = useState(false);
  const [streamStatus, setStreamStatus] = useState<PlanSubscriptionStatus>('stopped');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragged, setDragged] = useState<PlanCapability | null>(null);
  const manifestLoadedRef = useRef(false);

  useEffect(() => {
    if (!planId) return;
    manifestLoadedRef.current = false;
    return subscribePlanState({
      intervalMs: 1_500,
      load: async (cursor, signal) => {
        const response = await fetch(
          `/api/harness/plan?id=${encodeURIComponent(planId)}&cursor=${cursor}&manifest=${manifestLoadedRef.current ? 0 : 1}`,
          { signal, cache: 'no-store' },
        );
        const body = await response.json().catch(() => null) as PlanPollPayload | null;
        if (!response.ok || !body) throw new Error(`Plan request failed with ${response.status}.`);
        const degraded = body.degraded !== null && typeof body.degraded === 'object'
          ? body.degraded as Record<string, unknown>
          : null;
        if (degraded?.capabilities !== true) manifestLoadedRef.current = true;
        return body;
      },
      onState: (next) => {
        setSnapshot(next.snapshot);
        setCapabilities((current) => next.capabilities.length ? next.capabilities : current);
        setSelectedTaskId((current) => current && next.snapshot.tasks.some((task) => task.id === current)
          ? current
          : next.snapshot.tasks.find((task) => task.status === 'running' || task.status === 'failed')?.id
            ?? next.snapshot.tasks.find((task) => task.status !== 'superseded')?.id
            ?? null);
        setError(null);
      },
      onStatus: setStreamStatus,
      onError: (nextError) => setError(nextError.message),
    });
  }, [planId]);

  useEffect(() => {
    if (!snapshot) return;
    let active = true;
    void layoutGoalPlan(snapshot, hideSuperseded).then((layout) => {
      if (!active) return;
      setNodes(layout.nodes);
      setEdges(layout.edges);
    });
    return () => { active = false; };
  }, [hideSuperseded, snapshot]);

  const selectedTask = snapshot?.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const complete = snapshot ? planIsComplete(snapshot) : false;

  const mutate = useCallback(async (action: string, details: Record<string, unknown>) => {
    if (!planId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/harness/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, action, ...details }),
      });
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok) {
        const detail = [body?.detail, body?.rule, body?.receiptId].filter((value) => typeof value === 'string').join(' · ');
        throw new Error(detail || String(body?.error ?? `Plan action failed with ${response.status}.`));
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setBusy(false);
    }
  }, [planId]);

  const onDragStart = (event: DragStartEvent) => {
    setDragged((event.active.data.current?.capability as PlanCapability | undefined) ?? null);
  };
  const onDragEnd = (event: DragEndEvent) => {
    const capability = event.active.data.current?.capability as PlanCapability | undefined;
    const taskId = event.over?.data.current?.taskId as string | undefined;
    setDragged(null);
    if (!capability || !taskId) return;
    setSelectedTaskId(taskId);
    void mutate('queue_affordance', { taskId, affordanceRef: capability.id, config: {} });
  };

  const progress = useMemo(() => snapshot?.progress ?? { done: 0, total: 0 }, [snapshot]);
  return (
    <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragged(null)}>
      <section className="flex h-full min-h-0 flex-col bg-ij-editor text-ij-ink" data-goal-stack>
        <header className="flex shrink-0 items-center gap-3 border-b border-ij-seam bg-ij-chrome px-4 py-2">
          <div>
            <div className="text-ij-ink-info">Goal Stack</div>
            <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>{snapshot?.title ?? 'Open a plan'}</h2>
          </div>
          <form
            className="ml-auto flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (planInput.trim()) setPlanId(planInput.trim());
            }}
          >
            <input
              value={planInput}
              onChange={(event) => setPlanInput(event.target.value)}
              placeholder="Plan id"
              aria-label="Plan id"
              className="h-ij-control min-w-64 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 font-ij-mono focus:outline-2 focus:outline-ij-accent"
            />
            <button type="submit" className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright">Open</button>
          </form>
          <span className="font-ij-mono text-ij-ink-info" data-plan-stream={streamStatus}>{streamStatus}</span>
        </header>

        {snapshot ? (
          <div className="flex shrink-0 items-center gap-3 border-b border-ij-seam bg-ij-chrome px-3 py-1">
            <span>{progress.done} of {progress.total} verified</span>
            <span className="text-ij-ink-info">{snapshot.objective}</span>
            <button
              type="button"
              aria-pressed={hideSuperseded}
              onClick={() => setHideSuperseded((value) => !value)}
              className="ml-auto h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface"
            >
              {hideSuperseded ? 'Show prior generations' : 'Hide prior generations'}
            </button>
            <button
              type="button"
              disabled={!complete || busy}
              onClick={() => void mutate('save_as_program', {})}
              className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:opacity-50"
            >
              Save as program
            </button>
          </div>
        ) : null}
        {error ? <div role="alert" className="border-b border-ij-seam bg-ij-error-bg px-3 py-2 text-ij-error">{error}</div> : null}

        <div className="grid min-h-0 flex-1 grid-cols-4">
          <aside className="min-h-0 border-r border-ij-seam">
            <ToolPalette capabilities={capabilities} />
          </aside>
          <main className="col-span-2 min-h-0" aria-label="Plan canvas">
            {snapshot ? (
              <ReactFlow
                nodes={nodes.map((node) => ({ ...node, selected: node.id === selectedTaskId }))}
                edges={edges}
                nodeTypes={NODE_TYPES}
                edgeTypes={EDGE_TYPES}
                fitView
                fitViewOptions={{ padding: 0.16, minZoom: 0.4, maxZoom: 1 }}
                minZoom={0.2}
                maxZoom={1.6}
                nodesDraggable={false}
                nodesConnectable={false}
                onNodeClick={(_event, node) => setSelectedTaskId(node.id)}
                onPaneClick={() => setSelectedTaskId(null)}
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--ij-seam-raised)" />
                <Controls showInteractive={false} />
              </ReactFlow>
            ) : (
              <div className="flex h-full items-center justify-center text-ij-ink-info">
                Enter a Plan id to subscribe to its canonical task graph.
              </div>
            )}
          </main>
          <aside className="min-h-0 border-l border-ij-seam">
            <NodeInspector task={selectedTask} busy={busy} mutate={mutate} />
          </aside>
        </div>
      </section>
      <DragOverlay>
        {dragged ? (
          <div className="rounded-ij-arc border border-ij-accent bg-ij-raised p-2 text-ij-ink">
            {dragged.title}
          </div>
        ) : null}
      </DragOverlay>
      <PlanPermissionPrompt
        task={selectedTask}
        busy={busy}
        decide={(decision) => {
          if (selectedTask) void mutate('approval_decision', { taskId: selectedTask.id, decision });
        }}
      />
    </DndContext>
  );
}
