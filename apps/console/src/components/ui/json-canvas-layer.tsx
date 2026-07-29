'use client';

// SOURCING: Obsidian JSON Canvas 1.0 (@commonplace/json-canvas) as the interchange
// document; @xyflow/react as the spatial Z-layer renderer. Persists through
// CanvasStore / canvas.apply_json on canvas.inspector.rail — chrome-owned, not
// the claim/file CanvasView block companion.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Handle,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type ReactFlowInstance,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import type { BlockHost, JsonValue, Result, ObjectActionReceipt } from '@commonplace/block-view/types';
import {
  EMPTY_CANVAS,
  type CanvasEdge,
  type CanvasNode,
  type JSONCanvas,
} from '@commonplace/json-canvas';
import { INSPECTOR_CANVAS_ID, PERSISTENCE_UNAVAILABLE_NOTE } from '@/lib/canvas/store';

type JsonCanvasFlowNode = Node<{
  readonly kind: CanvasNode['type'];
  readonly label: string;
  readonly detail?: string;
}>;

export type InspectorCanvasHost = BlockHost & {
  readyCanvas(): Promise<void>;
  exportCanvasDocument(canvasId: string): JSONCanvas | null;
};

function labelFor(node: CanvasNode): string {
  switch (node.type) {
    case 'text':
      return node.text.slice(0, 80) || 'Text';
    case 'file':
      return node.file;
    case 'link':
      return node.url;
    case 'group':
      return node.label ?? 'Group';
  }
}

function detailFor(node: CanvasNode): string | undefined {
  switch (node.type) {
    case 'text':
      return undefined;
    case 'file':
      return node.subpath;
    case 'link':
      return 'link';
    case 'group':
      return 'group';
  }
}

function flowFromJsonCanvas(document: JSONCanvas): {
  nodes: JsonCanvasFlowNode[];
  edges: Edge[];
} {
  const nodes: JsonCanvasFlowNode[] = document.nodes.map((node) => ({
    id: node.id,
    type: node.type === 'group' ? 'group' : 'jsonCanvasNode',
    position: { x: node.x, y: node.y },
    style: { width: node.width, height: node.height },
    data: {
      kind: node.type,
      label: labelFor(node),
      detail: detailFor(node),
    },
  }));
  const edges: Edge[] = document.edges.map((edge: CanvasEdge) => ({
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    label: edge.label,
  }));
  return { nodes, edges };
}

function jsonCanvasFromFlow(
  previous: JSONCanvas,
  nodes: readonly JsonCanvasFlowNode[],
  edges: readonly Edge[],
): JSONCanvas {
  const previousById = new Map(previous.nodes.map((node) => [node.id, node]));
  const nextNodes: CanvasNode[] = nodes.map((node) => {
    const width = typeof node.style?.width === 'number' ? node.style.width : 240;
    const height = typeof node.style?.height === 'number' ? node.style.height : 120;
    const prior = previousById.get(node.id);
    if (prior) {
      return {
        ...prior,
        x: node.position.x,
        y: node.position.y,
        width,
        height,
      };
    }
    return {
      id: node.id,
      type: 'text',
      x: node.position.x,
      y: node.position.y,
      width,
      height,
      text: node.data.label,
    };
  });
  const nextEdges: CanvasEdge[] = edges
    .filter((edge) => edge.source && edge.target)
    .map((edge) => ({
      id: edge.id,
      fromNode: edge.source,
      toNode: edge.target,
      label: typeof edge.label === 'string' ? edge.label : undefined,
    }));
  return { nodes: nextNodes, edges: nextEdges };
}

function JsonCanvasNodeView({
  data,
}: {
  data: JsonCanvasFlowNode['data'];
}) {
  return (
    <article
      className="relative h-full min-h-[72px] rounded-lg border border-border/60 bg-card/90 px-3 py-2 text-ij-ink shadow-sm"
      data-json-canvas-node={data.kind}
    >
      {/* Top/bottom keeps handles inside the rail; right-edge sources were
          occluded by the inspector chrome (elementFromPoint missed them). */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-border !bg-muted-foreground/80"
      />
      <div className="font-ij-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {data.kind}
      </div>
      <h3 className="mt-1 line-clamp-3 text-[13px] font-medium leading-snug">{data.label}</h3>
      {data.detail ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{data.detail}</p>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-border !bg-muted-foreground/80"
      />
    </article>
  );
}

const NODE_TYPES = {
  jsonCanvasNode: JsonCanvasNodeView,
} as unknown as NodeTypes;

function isInspectorCanvasHost(host: BlockHost): host is InspectorCanvasHost {
  return (
    typeof (host as InspectorCanvasHost).readyCanvas === 'function'
    && typeof (host as InspectorCanvasHost).exportCanvasDocument === 'function'
  );
}

function receiptFailed(result: Result<ObjectActionReceipt>): string | null {
  if (!result.ok) return result.error ?? 'persist refused';
  if (result.value?.status !== 'applied') {
    return result.value?.status ? `persist ${result.value.status}` : 'persist refused';
  }
  return null;
}

/**
 * Obsidian JSON Canvas Z-layer for DashboardSidebar.
 * Hydrates and persists canvas.inspector.rail through the object seam.
 */
export function JsonCanvasLayer({
  host,
  canvasId = INSPECTOR_CANVAS_ID,
  className = '',
}: {
  readonly host: BlockHost;
  readonly canvasId?: string;
  readonly className?: string;
}) {
  const [document, setDocument] = useState<JSONCanvas>(EMPTY_CANVAS);
  const [nodes, setNodes] = useState<JsonCanvasFlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const documentRef = useRef(document);
  const lastReceiptedRef = useRef<JSONCanvas>(EMPTY_CANVAS);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);
  const flowRef = useRef<ReactFlowInstance<JsonCanvasFlowNode> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const applyLocal = useCallback((next: JSONCanvas) => {
    const flow = flowFromJsonCanvas(next);
    setDocument(next);
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, []);

  const persistDocument = useCallback((next: JSONCanvas) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void host.emit({
        kind: 'invoke_tool',
        tool: 'canvas.apply_json',
        args: {
          canvasId,
          document: next as unknown as JsonValue,
        },
      }).then((result) => {
        const error = receiptFailed(result);
        if (error) {
          setPersistError(error);
          applyLocal(lastReceiptedRef.current);
          return;
        }
        lastReceiptedRef.current = next;
        setPersistError(null);
      });
    }, 250);
  }, [applyLocal, canvasId, host]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      if (!isInspectorCanvasHost(host)) return;
      // Retry: CanvasStore.ready() rejects until both default + inspector
      // canvases are seeded on the object seam.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          await host.readyCanvas();
          if (cancelled) return;
          const exported = host.exportCanvasDocument(canvasId) ?? EMPTY_CANVAS;
          lastReceiptedRef.current = exported;
          applyLocal(exported);
          hydrated.current = true;
          setReady(true);
          setPersistError(null);
          return;
        } catch (error) {
          if (cancelled) return;
          setPersistError(error instanceof Error ? error.message : PERSISTENCE_UNAVAILABLE_NOTE);
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
    };
    void boot();
    return () => {
      cancelled = true;
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [applyLocal, canvasId, host]);

  const commitFlow = useCallback((
    nextNodes: JsonCanvasFlowNode[],
    nextEdges: Edge[],
  ) => {
    const next = jsonCanvasFromFlow(documentRef.current, nextNodes, nextEdges);
    setDocument(next);
    if (hydrated.current) persistDocument(next);
  }, [persistDocument]);

  const onNodesChange: OnNodesChange<JsonCanvasFlowNode> = useCallback((changes) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((current) => {
      const next = applyEdgeChanges(changes, current);
      const shouldPersist = changes.some(
        (change) => change.type === 'remove' || change.type === 'add',
      );
      if (shouldPersist && hydrated.current) {
        commitFlow(nodesRef.current, next);
      }
      return next;
    });
  }, [commitFlow]);

  const onNodeDragStop: OnNodeDrag<JsonCanvasFlowNode> = useCallback((_event, _node, nextNodes) => {
    setNodes(nextNodes);
    commitFlow(nextNodes, edgesRef.current);
  }, [commitFlow]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      return;
    }
    const id = `edge:${connection.source}->${connection.target}:${Date.now()}`;
    setEdges((current) => {
      const nextEdges = [
        ...current,
        { id, source: connection.source!, target: connection.target! },
      ];
      commitFlow(nodesRef.current, nextEdges);
      return nextEdges;
    });
  }, [commitFlow]);

  const createTextNodeAt = useCallback((clientX: number, clientY: number) => {
    const position = flowRef.current?.screenToFlowPosition({
      x: clientX,
      y: clientY,
    }) ?? { x: 48, y: 96 };
    const id = `text:${Date.now()}`;
    const node: JsonCanvasFlowNode = {
      id,
      type: 'jsonCanvasNode',
      position,
      style: { width: 240, height: 120 },
      data: { kind: 'text', label: 'Note' },
    };
    setNodes((current) => {
      const nextNodes = [...current, node];
      // Local create always; commitFlow only emits once hydrated.
      commitFlow(nextNodes, edgesRef.current);
      return nextNodes;
    });
  }, [commitFlow]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (event.detail !== 2) return;
    createTextNodeAt(event.clientX, event.clientY);
  }, [createTextNodeAt]);

  const onLayerDoubleClick = useCallback((event: React.MouseEvent) => {
    // Capture-path create: RF's default zoomOnDoubleClick / d3-zoom can swallow
    // the pane click path; this still fires for a pane double-click.
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.react-flow__pane')) return;
    if (target.closest('.react-flow__node, .react-flow__edge, .react-flow__handle')) return;
    event.preventDefault();
    createTextNodeAt(event.clientX, event.clientY);
  }, [createTextNodeAt]);

  return (
    <div
      className={`relative h-full min-h-0 w-full ${className}`}
      data-json-canvas-layer
      data-json-canvas-id={canvasId}
      data-json-canvas-nodes={String(document.nodes.length)}
      data-json-canvas-ready={ready ? 'true' : 'false'}
      data-json-canvas-persist-error={persistError ?? undefined}
      role="region"
      aria-label="Obsidian JSON Canvas"
      onDoubleClick={onLayerDoubleClick}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        nodesConnectable
        elementsSelectable
        connectionMode={ConnectionMode.Loose}
        panOnDrag
        zoomOnScroll
        // Default zoom-on-double-click steals the create-note gesture.
        zoomOnDoubleClick={false}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color="var(--border)"
        />
      </ReactFlow>
      {document.nodes.length === 0 ? (
        <p
          className="pointer-events-none absolute inset-x-3 bottom-3 z-20 rounded-md bg-card/70 px-2 py-1.5 text-[11px] text-muted-foreground backdrop-blur-[1px]"
          data-json-canvas-hint
        >
          Double-click the canvas to add a note
        </p>
      ) : null}
      {persistError ? (
        <p
          className="pointer-events-none absolute inset-x-3 top-3 z-20 rounded-md border border-destructive/40 bg-card/90 px-2 py-1.5 text-[11px] text-destructive"
          data-json-canvas-error
          role="status"
        >
          Canvas persist refused: {persistError}
        </p>
      ) : null}
    </div>
  );
}
