'use client';

// Models view: a React Flow modeling canvas over the same nodes (spec PT-007,
// React Flow). Each node binds community (the swatch color) and centrality (the
// swatch size) -- the same fields the Network and Ego views bind. Nodes are
// draggable and connectable; drawing an edge is the modeling affordance. React
// Flow provides keyboard node navigation and focusable nodes out of the box.

import { useCallback, useEffect, useMemo } from 'react';
import {
  addEdge,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { communityCss, isCommunityActive, nodeRadius, type V2GraphData } from '@/lib/commonplace/v2-graph';
import { NodeTypeIcon } from '@/lib/commonplace/node-icons';
import { SignalModelStrip } from './SignalModelStrip';
import styles from './graph.module.css';

type ModelNodeData = { label: string; type: string; community: number; centrality: number; onFocus: (id: string) => void };

function ModelNode({ id, data }: NodeProps<Node<ModelNodeData>>) {
  const s = nodeRadius(data.centrality, 22, 30);
  return (
    <button type="button" className={styles.modelNode} onClick={() => data.onFocus(id)}>
      <Handle type="target" position={Position.Left} />
      <span
        className={styles.modelSwatch}
        style={{ width: s, height: s, background: communityCss(data.community) }}
        aria-hidden="true"
      >
        <NodeTypeIcon type={data.type} size={Math.round(s * 0.58)} className={styles.modelSwatchIcon} />
      </span>
      <span className={styles.modelLabel}>{data.label}</span>
      <Handle type="source" position={Position.Right} />
    </button>
  );
}

const nodeTypes = { model: ModelNode };
const CANVAS_W = 960;
const CANVAS_H = 620;
const MAX_NODES = 40;

interface ModelsViewProps {
  data: V2GraphData;
  focusId: string | null;
  onFocus: (id: string) => void;
  selectedCommunities: readonly number[] | null;
}

export default function ModelsView({ data, focusId, onFocus, selectedCommunities }: ModelsViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const top = [...data.nodes].sort((a, b) => b.centrality - a.centrality).slice(0, MAX_NODES);
    const keep = new Set(top.map((n) => n.id));
    const nodes: Node<ModelNodeData>[] = top.map((n) => ({
      id: n.id,
      type: 'model',
      position: { x: n.x * CANVAS_W, y: n.y * CANVAS_H },
      data: { label: n.label, type: n.type, community: n.community, centrality: n.centrality, onFocus },
    }));
    const edges: Edge[] = data.links
      .filter((l) => keep.has(l.source) && keep.has(l.target))
      .map((l, i) => ({ id: `e${i}`, source: l.source, target: l.target, animated: false }));
    return { initialNodes: nodes, initialEdges: edges };
  }, [data.nodes, data.links, onFocus]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  return (
    <div className={styles.modelsFrame}>
      <SignalModelStrip />
      <ReactFlow
        nodes={nodes.map((n) => ({
          ...n,
          selected: n.id === focusId,
          style: { opacity: isCommunityActive(n.data.community, selectedCommunities) ? 1 : 0.28 },
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
