'use client';

// SOURCING: OWOX/models packages/web Canvas composition (Apache-2.0), gutted of
// Supabase/auth/Push/Share/Gemini/PostHog. Registry + layout seam owned by host.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlowProvider,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './../canvas/canvas.css';

import type { ModelGraph, ModelNode, ModelEdge } from '@commonplace/okf';
import {
  SubstrateEdge,
  createNodeKindRegistry,
} from '@commonplace/canvas-substrate';
import '@commonplace/canvas-substrate/substrate.css';

import { type MartNodeData } from '../canvas/MartNode';
import { buildRfEdges } from '../canvas/edges';
import { Dock, type Tool } from '../canvas/Dock';
import { ClearCanvasDialog } from '../ClearCanvasDialog';
import { TopBar } from '../TopBar';
import { Inspector } from '../inspector/Inspector';
import { ModelSheet } from '../rail/ModelSheet';
import { RightRail } from '../rail/RightRail';
import { HistoryPanel, type RegistryVersionRow } from '../rail/HistoryPanel';
import { MyModelsPanel, type ModelScopeRow } from '../rail/MyModelsPanel';
import { useRightPanel } from '../rail/useRightPanel';
import { modelCardKind } from '../../kinds/modelCardKind';
import { createModelStore } from '../../state/model';
import { graphWithChangedNodePositions } from '../../state/positions';
import { type ViewMode } from '../../state/viewMode';
import { type RelLabelMode } from '../../state/relLabels';
import { NOTHING_HIDDEN, type ObjHidden } from '../../state/objLabels';

const kinds = createNodeKindRegistry([modelCardKind]);
const nodeTypes = kinds.nodeTypes();
const edgeTypes = { rel: SubstrateEdge, substrate: SubstrateEdge };

const SHEET_TITLES: Record<string, string> = {
  inspect: 'Inspector',
  models: 'Models',
  history: 'History',
};

export type OwoxStudioProps = {
  readonly initialGraph?: ModelGraph;
  readonly graph?: ModelGraph;
  readonly onGraphChange?: (graph: ModelGraph) => void;
  readonly onNodeSelect?: (nodeKey: string | null) => void;
  readonly onFieldSelect?: (nodeKey: string, fieldName: string) => void;
  readonly onEdgeSelect?: (edgeKey: string) => void;
  readonly modelName?: string;
  readonly onImport?: () => void;
  readonly onExport?: () => void;
  readonly onDeclare?: () => void;
  readonly declareDisabled?: boolean;
  readonly pendingCount?: number;
  /** Registry-backed spawn. When set, double-click / Add uses this instead of a local-only node. */
  readonly onSpawnObject?: (position: { x: number; y: number }) => void;
  readonly versions?: readonly RegistryVersionRow[];
  readonly onCompareVersion?: (id: string) => void;
  readonly onRestoreVersion?: (id: string) => void;
  readonly modelScopes?: readonly ModelScopeRow[];
  readonly activeScopeId?: string | null;
  readonly onOpenScope?: (id: string) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
};

type Selection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | null;

function graphToNodes(
  graph: ModelGraph,
  onFieldSelect?: OwoxStudioProps['onFieldSelect'],
  viewMode: ViewMode = 'erd',
): Node[] {
  return graph.nodes.map((n) => {
    const data = n as MartNodeData;
    return {
      id: n.key,
      type: 'mart',
      position: n.position,
      data: {
        ...data,
        _viewMode: data._viewMode ?? viewMode,
        _onFieldSelect: onFieldSelect
          ? (fieldName: string) => onFieldSelect(n.key, fieldName)
          : data._onFieldSelect,
      } satisfies MartNodeData,
    };
  });
}

function StudioInner({
  initialGraph,
  graph: controlled,
  onGraphChange,
  onNodeSelect,
  onFieldSelect,
  onEdgeSelect,
  modelName = 'Data model',
  onImport,
  onExport,
  onDeclare,
  declareDisabled,
  pendingCount = 0,
  onSpawnObject,
  versions = [],
  onCompareVersion,
  onRestoreVersion,
  modelScopes = [],
  activeScopeId,
  onOpenScope,
  className,
  style,
}: OwoxStudioProps) {
  const [store] = useState(() =>
    createModelStore(controlled ?? initialGraph ?? { storageId: null, nodes: [], edges: [] }),
  );
  const snap = useSyncExternalStore(store.subscribe, store.get, store.get);
  const live = controlled ?? snap;

  const [tool, setTool] = useState<Tool>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('erd');
  const [relLabelMode, setRelLabelMode] = useState<RelLabelMode>('all');
  const [objHidden, setObjHidden] = useState<ObjHidden>(NOTHING_HIDDEN);
  const [selection, setSelection] = useState<Selection>(null);
  const [showClear, setShowClear] = useState(false);
  const panel = useRightPanel();
  const lastSelectionIdentity = useRef('none');

  const [nodes, setNodes] = useState<Node[]>(() => graphToNodes(live, onFieldSelect, viewMode));
  const edges: Edge[] = useMemo(
    () => buildRfEdges(live.edges, live.nodes, viewMode, relLabelMode),
    [live.nodes, live.edges, viewMode, relLabelMode],
  );
  const didFitView = useRef(false);
  const flowRef = useRef<{ fitView: (opts?: { padding?: number }) => void } | null>(null);

  useEffect(() => {
    if (didFitView.current || live.nodes.length === 0 || !flowRef.current) return;
    didFitView.current = true;
    flowRef.current.fitView({ padding: 0.2 });
  }, [live.nodes.length]);


  useEffect(() => {
    setNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]));
      return graphToNodes(live, onFieldSelect, viewMode).map((node) => {
        const previous = currentById.get(node.id);
        return previous?.dragging
          ? { ...node, position: previous.position, dragging: true }
          : node;
      });
    });
  }, [live, onFieldSelect, viewMode]);

  const commitGraph = useCallback(
    (next: ModelGraph) => {
      if (!controlled) store.set(next);
      onGraphChange?.(next);
    },
    [controlled, onGraphChange, store],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev);
        // Mid-drag position streams must not rewrite the controlled host graph.
        // That rebuild remounts MartNodes and fights React Flow, which reads as
        // the whole canvas blanking or glitching. Commit only when the drag
        // ends (dragging === false) or for non-position structural changes.
        const dragInProgress = changes.some(
          (change) => change.type === 'position' && change.dragging === true,
        );
        if (!dragInProgress) {
          const updated = graphWithChangedNodePositions(live, next);
          if (updated) commitGraph(updated);
        }
        return next;
      });
    },
    [commitGraph, live],
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
        setSelection({ type: 'edge', id: edgeId });
        onEdgeSelect?.(edgeId);
        panel.open('inspect');
        return;
      }
      const id = params.nodes[0]?.id ?? null;
      const identity = id ? `node:${id}` : 'none';
      if (lastSelectionIdentity.current === identity) return;
      lastSelectionIdentity.current = identity;
      setSelection(id ? { type: 'node', id } : null);
      onNodeSelect?.(id);
      if (id) panel.open('inspect');
    },
    [onEdgeSelect, onNodeSelect, panel],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const edge = store.addEdge(
        connection.source,
        connection.target,
        connection.sourceHandle,
        connection.targetHandle,
      );
      if (edge) commitGraph(store.get());
    },
    [commitGraph, store],
  );

  const handleWrapperDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (tool !== 'add' && tool !== 'select') return;
      const target = event.target as HTMLElement;
      if (!target.classList.contains('react-flow__pane')) return;
      const bounds = target.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 120,
        y: event.clientY - bounds.top - 40,
      };
      if (onSpawnObject) {
        onSpawnObject(position);
        return;
      }
      store.addNode(position);
      commitGraph(store.get());
    },
    [commitGraph, onSpawnObject, store, tool],
  );

  const handleToggleView = useCallback(() => {
    setViewMode((mode) => (mode === 'erd' ? 'compact' : 'erd'));
  }, []);

  const handleRelLabelModeChange = useCallback((mode: RelLabelMode) => {
    setRelLabelMode(mode);
  }, []);

  const handleObjHiddenChange = useCallback((hidden: ObjHidden) => {
    setObjHidden(hidden);
  }, []);

  const clearCanvas = useCallback(() => {
    commitGraph({ ...live, nodes: [], edges: [] });
    setSelection(null);
    setShowClear(false);
  }, [commitGraph, live]);

  const updateNode = useCallback(
    (key: string, patch: Partial<ModelNode>) => {
      store.updateNode(key, patch);
      commitGraph(store.get());
    },
    [commitGraph, store],
  );

  const updateEdge = useCallback(
    (id: string, patch: Partial<ModelEdge>) => {
      store.updateEdge(id, patch);
      commitGraph(store.get());
    },
    [commitGraph, store],
  );

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 320,
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
      data-testid="model-canvas-shell"
      data-register-impl="model-canvas.owox"
      data-network="none"
    >
      <TopBar
        modelName={modelName}
        onImport={onImport}
        onExport={onExport}
        exportDisabled={live.nodes.length === 0}
        onDeclare={onDeclare}
        declareDisabled={declareDisabled}
        pendingCount={pendingCount}
      />

      <div className="relative flex min-h-0 flex-1">
        <div
          className="relative h-full min-h-0 min-w-0 flex-1"
          onDoubleClick={handleWrapperDoubleClick}
        >
          <Dock
            activeTool={tool}
            onToolChange={setTool}
            viewMode={viewMode}
            onToggleView={handleToggleView}
            onClear={() => setShowClear(true)}
            clearDisabled={live.nodes.length === 0}
            relLabelMode={relLabelMode}
            onRelLabelModeChange={handleRelLabelModeChange}
            objHidden={objHidden}
            onObjHiddenChange={handleObjHiddenChange}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            connectionMode={ConnectionMode.Loose}
            onInit={(instance) => {
              flowRef.current = instance;
              if (didFitView.current || live.nodes.length === 0) return;
              didFitView.current = true;
              void instance.fitView({ padding: 0.2 });
            }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={tool === 'select'}
            panOnDrag={tool === 'select'}
            selectNodesOnDrag={false}
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} />
            <Controls position="bottom-left" style={{ bottom: 24, left: 15, margin: 0 }} />
          </ReactFlow>

          {live.nodes.length === 0 ? (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 text-center text-[15px] text-[color:var(--ij-text-secondary,#64748b)]"
              data-owox-empty-canvas
            >
              <div>
                <strong className="text-[color:var(--ij-ink,#0f172a)]">Empty canvas</strong>
              </div>
              <div className="mt-[6px] text-[13px] leading-[1.6]">
                Double-click anywhere to add an object.
                <br />
                Drag from a node&apos;s port to create a relationship.
              </div>
            </div>
          ) : null}
        </div>

        <ModelSheet
          active={panel.active}
          modal={panel.active !== 'inspect'}
          title={SHEET_TITLES[panel.active ?? 'inspect'] ?? 'Panel'}
          onClose={() => {
            const wasInspect = panel.active === 'inspect';
            panel.close();
            if (wasInspect) setSelection(null);
          }}
        >
          {panel.active === 'inspect' ? (
            <Inspector
              selection={selection}
              nodes={live.nodes}
              edges={live.edges}
              onUpdateNode={updateNode}
              onUpdateEdge={updateEdge}
              onClose={() => {
                panel.close();
                setSelection(null);
              }}
              embedded
            />
          ) : null}
          {panel.active === 'models' ? (
            <MyModelsPanel
              models={modelScopes}
              activeId={activeScopeId}
              onOpen={onOpenScope}
            />
          ) : null}
          {panel.active === 'history' ? (
            <HistoryPanel
              versions={versions}
              onCompare={(id) => onCompareVersion?.(id)}
              onRestore={(id) => onRestoreVersion?.(id)}
            />
          ) : null}
        </ModelSheet>

        <RightRail active={panel.active} onOpen={panel.open} />
      </div>

      {showClear ? (
        <ClearCanvasDialog
          counts={{ marts: live.nodes.length, relationships: live.edges.length }}
          onDelete={clearCanvas}
          onExportAndDelete={() => {
            onExport?.();
            clearCanvas();
          }}
          onClose={() => setShowClear(false)}
        />
      ) : null}
    </div>
  );
}

/** Full OWOX-shaped Models studio: TopBar + Dock + canvas + Inspector sheet + rail. */
export function OwoxStudio(props: OwoxStudioProps) {
  return (
    <ReactFlowProvider>
      <StudioInner {...props} />
    </ReactFlowProvider>
  );
}

/** Back-compat alias — ModelCanvasShell is now the OWOX studio composition. */
export function ModelCanvasShell(props: OwoxStudioProps) {
  return <OwoxStudio {...props} />;
}

export type ModelCanvasShellProps = OwoxStudioProps;
