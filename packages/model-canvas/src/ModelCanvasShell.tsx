'use client';

// SOURCING: OWOX/models hard fork (Apache-2.0). MartNode + RelEdge + xyflow.
// Empty in-memory ERD shell for MF1: zero network, no Supabase/PostHog/OWOX.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeChange,
  applyNodeChanges,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './components/canvas/canvas.css';

import type { ModelGraph } from '@commonplace/okf';
import {
  SubstrateEdge,
  createNodeKindRegistry,
} from '@commonplace/canvas-substrate';
import '@commonplace/canvas-substrate/substrate.css';
import { type MartNodeData } from './components/canvas/MartNode';
import { buildRfEdges } from './components/canvas/edges';
import { modelCardKind, MODEL_CARD_KIND } from './kinds/modelCardKind';
import { createModelStore } from './state/model';
import { graphWithChangedNodePositions } from './state/positions';

// The ERD card is now a registry entry on the shared substrate rather than a
// bespoke node component, and relation edges ride the one edge language with
// the model palette. `mart` and `rel` stay mapped so saved graphs that name the
// old types keep rendering.
const kinds = createNodeKindRegistry([modelCardKind]);
const kindTypes = kinds.nodeTypes();
const nodeTypes = { ...kindTypes, mart: kindTypes[MODEL_CARD_KIND] };
const edgeTypes = { rel: SubstrateEdge, substrate: SubstrateEdge };

export type ModelCanvasShellProps = {
  /** Optional initial graph. Defaults to empty (MF1 boot proof). */
  readonly initialGraph?: ModelGraph;
  /** Controlled graph from the registry adapter (MF3). */
  readonly graph?: ModelGraph;
  readonly onGraphChange?: (graph: ModelGraph) => void;
  readonly onNodeSelect?: (nodeKey: string | null) => void;
  readonly onFieldSelect?: (nodeKey: string, fieldName: string) => void;
  readonly onEdgeSelect?: (edgeKey: string) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
};

function graphToNodes(
  graph: ModelGraph,
  onFieldSelect?: ModelCanvasShellProps['onFieldSelect'],
): Node[] {
  return graph.nodes.map((n) => {
    const data = n as MartNodeData;
    return {
      id: n.key,
      type: 'mart',
      position: n.position,
      data: {
        ...data,
        _viewMode: data._viewMode ?? 'erd',
        _onFieldSelect: onFieldSelect
          ? (fieldName: string) => onFieldSelect(n.key, fieldName)
          : data._onFieldSelect,
      } satisfies MartNodeData,
    };
  });
}

function ShellInner({
  initialGraph,
  graph: controlled,
  onGraphChange,
  onNodeSelect,
  onFieldSelect,
  onEdgeSelect,
  className,
  style,
}: ModelCanvasShellProps) {
  const [store] = useState(() =>
    createModelStore(controlled ?? initialGraph ?? { storageId: null, nodes: [], edges: [] }),
  );
  const live = controlled ?? store.get();
  const [nodes, setNodes] = useState<Node[]>(() => graphToNodes(live, onFieldSelect));
  const lastSelectionIdentity = useRef('none');
  const edges: Edge[] = useMemo(
    () => buildRfEdges(live.edges, live.nodes, 'erd', 'all'),
    [live.nodes, live.edges],
  );

  useEffect(() => {
    setNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]));
      return graphToNodes(live, onFieldSelect).map((node) => {
        const previous = currentById.get(node.id);
        return previous?.dragging
          ? { ...node, position: previous.position, dragging: true }
          : node;
      });
    });
  }, [live, onFieldSelect]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev);
        const updated = graphWithChangedNodePositions(live, next);
        if (!updated) return next;
        if (!controlled) store.set(updated);
        onGraphChange?.(updated);
        return next;
      });
    },
    [controlled, live, onGraphChange, store],
  );

  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const selectedEdge = params.edges[0];
      if (selectedEdge) {
        const modelEdgeId = selectedEdge.data?.modelEdgeId;
        const edgeId = typeof modelEdgeId === 'string'
          ? modelEdgeId
          : selectedEdge.id.split('::', 1)[0];
        const identity = `edge:${edgeId}`;
        if (lastSelectionIdentity.current === identity) return;
        lastSelectionIdentity.current = identity;
        onEdgeSelect?.(edgeId);
        return;
      }
      const id = params.nodes[0]?.id ?? null;
      const identity = id ? `node:${id}` : 'none';
      if (lastSelectionIdentity.current === identity) return;
      lastSelectionIdentity.current = identity;
      onNodeSelect?.(id);
    },
    [onEdgeSelect, onNodeSelect],
  );

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', minHeight: 320, ...style }}
      data-testid="model-canvas-shell"
      data-network="none"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onSelectionChange={onSelectionChange}
        connectionMode={ConnectionMode.Loose}
        fitView
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function ModelCanvasShell(props: ModelCanvasShellProps) {
  return (
    <ReactFlowProvider>
      <ShellInner {...props} />
    </ReactFlowProvider>
  );
}
