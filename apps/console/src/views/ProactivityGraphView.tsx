'use client';

// SOURCING: @xyflow/react (controlled graph canvas) and @dagrejs/dagre
// (deterministic topology). The graph consumes one denormalized server shape;
// it neither joins domain records nor uses force-directed placement.

import { useEffect, useMemo, useState } from 'react';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type NodeProps,
} from '@xyflow/react';
import type { BlockHost } from '@commonplace/block-view/types';
import {
  layoutProactivityGraph,
  type ProactivityFlowNode,
} from '@/lib/proactivity/graph-layout';
import { useProactivityStore } from '@/lib/proactivity/proactivity-store';
import type { ProactivityGraphNode } from '@/lib/proactivity/types';
import type { PendingProactivityCompilation } from '@/lib/proactivity/types';
import { firingPath, type ProactiveFiring } from '@/lib/proactivity/use-proactivity-overlay';

function resolvedSummary(node: ProactivityGraphNode): string {
  if (node.kind === 'response') {
    const action = typeof node.resolved.actionClass === 'string' ? node.resolved.actionClass : 'action pending';
    const permission = typeof node.resolved.permissionState === 'string' ? node.resolved.permissionState : 'permission unresolved';
    return `${action} · ${permission}`;
  }
  if (node.kind === 'watch') {
    return typeof node.resolved.condition === 'string' ? node.resolved.condition : 'condition unresolved';
  }
  if (node.kind === 'judgment') {
    return typeof node.resolved.class === 'string' ? node.resolved.class : 'judgment unresolved';
  }
  if (node.kind === 'stake') {
    const assumptions = Array.isArray(node.resolved.assumptions) ? node.resolved.assumptions.length : 0;
    return `${assumptions} assumption${assumptions === 1 ? '' : 's'}`;
  }
  return node.author;
}

function ProactivityNode({ data, selected }: NodeProps<ProactivityFlowNode>) {
  const node = data.node;
  return (
    <div
      className="h-full rounded-ij-arc border border-ij-seam-raised bg-ij-raised px-3 py-2 shadow-ij-material"
      data-proactivity-node={node.kind}
      data-proactivity-node-id={node.id}
      data-proactivity-enabled={node.enabled}
      data-proactivity-selected={selected}
      aria-label={`${node.kind}: ${node.label}`}
    >
      <Handle type="target" position={Position.Left} className="!border-ij-seam !bg-ij-editor" />
      <div className="flex items-center justify-between gap-2 text-ij-ink-info">
        <span className="font-ij-mono text-xs uppercase">{node.kind}</span>
        <span className={node.enabled ? 'text-ij-ink-info' : 'text-ij-ink-disabled'}>
          {node.enabled ? 'enabled' : 'paused'}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-ij-ink">{node.label}</p>
      <p className="mt-1 truncate font-ij-mono text-xs text-ij-ink-info">{resolvedSummary(node)}</p>
      <Handle type="source" position={Position.Right} className="!border-ij-seam !bg-ij-editor" />
    </div>
  );
}

const NODE_TYPES = { proactivity: ProactivityNode };

export function ProactivityGraphView({ host: _host }: { host: BlockHost }) {
  const graph = useProactivityStore((state) => state.graph);
  const status = useProactivityStore((state) => state.status);
  const error = useProactivityStore((state) => state.error);
  const highlightedNodeIds = useProactivityStore((state) => state.highlightedNodeIds);
  const highlight = useProactivityStore((state) => state.highlight);
  const hydrate = useProactivityStore((state) => state.hydrate);
  const [intent, setIntent] = useState('');
  const [compilation, setCompilation] = useState<PendingProactivityCompilation | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compilationError, setCompilationError] = useState<string | null>(null);
  const flow = useMemo(
    () => (graph ? layoutProactivityGraph(graph) : { nodes: [], edges: [] }),
    [graph],
  );
  const nodes = useMemo(
    () => flow.nodes.map((node) => ({
      ...node,
      className: highlightedNodeIds.has(node.id) ? 'proactivity-node-highlighted' : undefined,
    })),
    [flow.nodes, highlightedNodeIds],
  );

  useEffect(() => {
    if (status !== 'ready' || !graph) return;
    const stream = new EventSource('/api/proactivity/stream');
    const onFiring = (event: MessageEvent<string>) => {
      try {
        highlight(firingPath(graph, JSON.parse(event.data) as ProactiveFiring));
      } catch {
        // A malformed upstream event cannot overwrite the projection.
      }
    };
    stream.addEventListener('proactivity.firing', onFiring as EventListener);
    stream.onmessage = onFiring;
    return () => stream.close();
  }, [graph, highlight, status]);

  const compile = async () => {
    const text = intent.trim();
    if (!text || compiling) return;
    setCompiling(true);
    setCompilationError(null);
    try {
      const response = await fetch('/api/proactivity/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: text }),
      });
      if (!response.ok || !response.body) throw new Error(`Compilation request failed: ${response.status}`);
      const parser = createParser({
        onEvent(event: EventSourceMessage) {
          if (event.event === 'compilation') {
            try {
              setCompilation(JSON.parse(event.data) as PendingProactivityCompilation);
            } catch {
              setCompilationError('The compiler returned an invalid pending review.');
            }
          }
          if (event.event === 'error') {
            try {
              const payload = JSON.parse(event.data) as { error?: string };
              setCompilationError(payload.error ?? 'Compilation failed.');
            } catch {
              setCompilationError(event.data || 'Compilation failed.');
            }
          }
        },
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
      parser.feed(decoder.decode());
    } catch (error) {
      setCompilationError(error instanceof Error ? error.message : 'Compilation failed.');
    } finally {
      setCompiling(false);
    }
  };

  const decideCompilation = async (action: 'commit' | 'discard') => {
    if (!compilation || compiling) return;
    setCompiling(true);
    setCompilationError(null);
    try {
      const response = await fetch(
        `/api/proactivity/compilations/${encodeURIComponent(compilation.id)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      );
      const payload = await response.json().catch(() => null) as { graph?: unknown; error?: unknown } | null;
      if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : `Compilation ${action} failed.`);
      if (action === 'commit' && payload?.graph && typeof payload.graph === 'object') {
        hydrate(payload.graph as Parameters<typeof hydrate>[0]);
      }
      setCompilation(null);
      setIntent('');
    } catch (error) {
      setCompilationError(error instanceof Error ? error.message : `Compilation ${action} failed.`);
    } finally {
      setCompiling(false);
    }
  };

  if (status === 'loading') {
    return <div className="flex h-full items-center justify-center text-ij-ink-info" data-proactivity-loading>Loading proactivity graph.</div>;
  }
  if (status !== 'ready' || !graph) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-ij-ink-info" data-proactivity-unavailable>
        Proactivity graph unavailable: {error ?? 'server projection not ready'}.
      </div>
    );
  }
  return (
    <section className="flex h-full min-h-0 flex-col bg-ij-chrome" data-proactivity-graph>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ij-seam px-3 py-2">
        <div>
          <h1 className="text-sm text-ij-ink">Proactivity</h1>
          <p className="font-ij-mono text-xs text-ij-ink-info">{graph.nodes.length} nodes · {graph.edges.length} reasons</p>
        </div>
        <form
          className="flex min-w-0 items-center gap-2"
          data-proactivity-compile
          onSubmit={(event) => {
            event.preventDefault();
            void compile();
          }}
        >
          <label className="sr-only" htmlFor="proactivity-intent">Compile a proactivity intent</label>
          <input
            id="proactivity-intent"
            className="min-w-0 rounded border border-ij-seam bg-ij-editor px-2 py-1 text-xs text-ij-ink"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            placeholder="Compile an intent for review"
            disabled={compiling || compilation !== null}
          />
          <button
            className="rounded border border-ij-seam-raised bg-ij-raised px-2 py-1 font-ij-mono text-xs text-ij-ink disabled:text-ij-ink-disabled"
            type="submit"
            disabled={!intent.trim() || compiling || compilation !== null}
          >
            {compiling ? 'Compiling…' : 'Compile'}
          </button>
        </form>
      </header>
      {compilation && (
        <aside className="shrink-0 border-b border-ij-seam bg-ij-raised px-3 py-2" data-proactivity-pending-compilation>
          <p className="font-ij-mono text-xs text-ij-ink-info">Pending review · nothing is live yet</p>
          <ul className="mt-1 space-y-1 text-xs text-ij-ink">
            {compilation.candidates.map((candidate, index) => (
              <li key={`${candidate.kind}-${index}`} data-proactivity-candidate={candidate.kind}>
                <span className="font-ij-mono text-ij-ink-info">{candidate.kind}</span> · {candidate.label}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button className="rounded border border-ij-seam-raised bg-ij-editor px-2 py-1 text-xs text-ij-ink" type="button" onClick={() => void decideCompilation('commit')} disabled={compiling}>Commit reviewed nodes</button>
            <button className="rounded border border-ij-seam px-2 py-1 text-xs text-ij-ink-info" type="button" onClick={() => void decideCompilation('discard')} disabled={compiling}>Discard</button>
          </div>
        </aside>
      )}
      {compilationError && <p className="shrink-0 border-b border-ij-seam px-3 py-1 text-xs text-red-700" data-proactivity-compilation-error>{compilationError}</p>}
      <div className="min-h-0 flex-1" data-proactivity-canvas>
        <ReactFlow<ProactivityFlowNode>
          nodes={nodes}
          edges={flow.edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesConnectable={false}
          nodesDraggable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--ij-divider)" gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
