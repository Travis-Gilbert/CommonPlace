'use client';

// SOURCING: @xyflow/react wrap for SPEC-PROGRAM-CANVAS-1.0 ProgramView (PG3-PG6).
// Catalog-driven nodes; MCP catalog/list/load/save/valid_next; no fixture path.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnConnectEnd,
  type OnEdgesChange,
  type OnNodesChange,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import {
  ConnectionSatisfaction,
  EMPTY_LAYOUT,
  SubstrateEdge,
  createNodeKindRegistry,
  edgeWaypoints,
  fromLayoutWire,
  insertWaypoint,
  makeConnectionLine,
  marchingEdgeIds,
  moveWaypoint,
  removeWaypoint,
  toLayoutWire,
  withEdgeWaypoints,
  withNodeLayout,
  type CanvasLayoutDocument,
  type EdgeFamily,
  type SubstrateEdgeData,
} from '@commonplace/canvas-substrate';
import '@commonplace/canvas-substrate/substrate.css';
import type {
  CatalogEntry,
  CompilerProposal,
  JsonValue,
  PinnedNodeValue,
  ProcessLiveness,
  ProgramBindingPreset,
  ProgramDefinition,
  ProgramDiff,
  ProgramRunOptions,
  ProgramRunReceipt,
  ProgramValueRef,
} from '@commonplace/program-contracts';
import { BlockShell } from '@/components/block/BlockShell';
import { degradationFor } from '@/lib/degradation';
import { PROGRAM_NODE_KIND, programNodeKind, type ProgramNodeData } from './programNodeKind';
import { ProgramWidget } from './ProgramWidget';
import {
  BINDING_PRESET_DRAG_TYPE,
  BindingStationTray,
} from './BindingStationTray';
import { PlaceholderNode } from './PlaceholderNode';
import { NodePalette } from './NodePalette';
import { RunRail } from './RunRail';
import { ProposalOverlay } from './ProposalOverlay';
import { layoutProgramGraph } from './layout';
import { shapeClassFor } from './shapeHue';
import { publishSubgraph } from './publish';
import {
  schemaMismatchMessage,
  typesCompatibleClient,
} from './connection';
import { applyRunEvent } from './liveness';
import { programNodeFromCatalog } from './catalogNode';
import {
  advanceProgramPin,
  collapseProgramNode,
  dropBindingPreset,
  expandProgramNode,
  fetchBindingPresets,
  fetchProgramCatalog,
  fetchProgramInterior,
  fetchProgramContext,
  fetchProgramSpill,
  fetchStarterPrograms,
  forkProgramDefinition,
  listPrograms,
  loadProgram,
  materializeProgram,
  resumeProgramDefinition,
  runProgramDefinition,
  saveProgramDraft,
  validNext,
  validateCompilerProposal,
  validateEdgeSchema,
  type ProgramListItem,
} from './programClient';

function diffPrograms(left: ProgramDefinition, right: ProgramDefinition): ProgramDiff {
  const leftNodes = new Set(left.nodes.map((node) => node.id));
  const rightNodes = new Set(right.nodes.map((node) => node.id));
  const leftEdges = new Set(left.edges.map((edge) => edge.id));
  const rightEdges = new Set(right.edges.map((edge) => edge.id));
  return {
    node_ids_only_in_left: [...leftNodes].filter((id) => !rightNodes.has(id)),
    node_ids_only_in_right: [...rightNodes].filter((id) => !leftNodes.has(id)),
    edge_ids_only_in_left: [...leftEdges].filter((id) => !rightEdges.has(id)),
    edge_ids_only_in_right: [...rightEdges].filter((id) => !leftEdges.has(id)),
    changed_node_ids: [...rightNodes].filter((id) => {
      if (!leftNodes.has(id)) return false;
      const a = left.nodes.find((node) => node.id === id);
      const b = right.nodes.find((node) => node.id === id);
      return JSON.stringify(a) !== JSON.stringify(b);
    }),
    metadata_changed: JSON.stringify(left.metadata) !== JSON.stringify(right.metadata),
    authority_changed: left.authority !== right.authority,
  };
}

// The program node is a substrate kind now, so this map is assembled from the
// registry instead of hand-written. The kind declares its own `program` alias,
// so graphs saved under the old type name keep rendering.
const KIND_REGISTRY = createNodeKindRegistry([programNodeKind]);

const NODE_TYPES: NodeTypes = {
  ...KIND_REGISTRY.nodeTypes({ Widget: ProgramWidget }),
  placeholder: PlaceholderNode,
};

const EDGE_TYPES: EdgeTypes = {
  program: SubstrateEdge,
};

function emptyDraft(tenantId: string): ProgramDefinition {
  return {
    tenant_id: tenantId,
    name: 'Untitled program',
    intent: '',
    authority: 'advisory',
    environment: { bindings: [] },
    trigger: { kind: 'graph_change', labels: [], properties: [] },
    budget: { max_invocations: 10, window_seconds: 3600, max_cost_microunits: 1 },
    approval: { mode: 'preapproved_within_grants', grant_ids: [] },
    nodes: [],
    edges: [],
    metadata: { draft: true },
  };
}

/** Per-node handlers the substrate kind needs, supplied once by the view. */
interface NodeHandlers {
  readonly onToggleCollapsed: (nodeId: string) => void;
  readonly onToggleAdvanced: (nodeId: string) => void;
  readonly onToggleFlag: (nodeId: string, flag: 'bypassed' | 'muted') => void;
  readonly onTweakChange: (nodeId: string, portId: string, value: unknown) => void;
}

function definitionToFlow(
  definition: ProgramDefinition,
  catalogById: Map<string, CatalogEntry>,
  layout: CanvasLayoutDocument,
  handlers: NodeHandlers,
  tweaksByNode: Readonly<Record<string, Record<string, unknown>>> = {},
): { nodes: Node[]; edges: Edge[] } {
  // An input with an incoming edge stays a port; an unconnected one becomes a
  // parameter widget. Computing it here keeps the kind free of edge knowledge.
  const connectedByNode = new Map<string, string[]>();
  for (const edge of definition.edges) {
    const ports = connectedByNode.get(edge.to_node) ?? [];
    ports.push(edge.to_port);
    connectedByNode.set(edge.to_node, ports);
  }

  const rawNodes: Node[] = definition.nodes.map((node, index) => {
    const entry = catalogById.get(node.block_id);
    const nodeLayout = layout.nodes[node.id];
    const data: ProgramNodeData = {
      label: entry?.class_name ?? entry?.id ?? node.block_id,
      catalogId: node.block_id,
      kind: node.kind,
      inputs: node.inputs.map((port) => ({ id: port.id, shape: port.shape_id })),
      outputs: node.outputs.map((port) => ({ id: port.id, shape: port.shape_id })),
      catalog: entry,
      lifecycle: entry?.lifecycle,
      refusal: entry ? undefined : `Unknown catalog id ${node.block_id}`,
      bypassed: node.bypassed,
      muted: node.muted,
      station: node.station ?? undefined,
      collapsed: nodeLayout?.collapsed,
      advancedOpen: nodeLayout?.advancedOpen,
      connectedInputs: connectedByNode.get(node.id) ?? [],
      advancedPorts: nodeLayout?.advancedPorts,
      tweaks: tweaksByNode[node.id] ?? {},
      onToggleCollapsed: () => handlers.onToggleCollapsed(node.id),
      onToggleAdvanced: () => handlers.onToggleAdvanced(node.id),
      onToggleFlag: (flag) => handlers.onToggleFlag(node.id, flag),
      onTweakChange: (portId, value) => handlers.onTweakChange(node.id, portId, value),
    };
    return {
      id: node.id,
      type: entry ? PROGRAM_NODE_KIND : 'placeholder',
      position: nodeLayout ? { x: nodeLayout.x, y: nodeLayout.y } : { x: index * 220, y: 40 },
      data: entry
        ? (data as unknown as Record<string, unknown>)
        : {
            catalogId: node.block_id,
            refusal: data.refusal,
            inputs: node.inputs.map((port) => port.id),
            outputs: node.outputs.map((port) => port.id),
          },
    };
  });

  const portShapeById = new Map<string, string>();
  for (const node of definition.nodes) {
    for (const port of node.outputs) {
      portShapeById.set(`${node.id}:${port.id}`, port.shape_id);
    }
  }

  const edges: Edge[] = definition.edges.map((edge) => {
    const shape = portShapeById.get(`${edge.from_node}:${edge.from_port}`);
    const data: SubstrateEdgeData = {
      palette: 'program',
      family: shape ? shapeClassFor(shape) : undefined,
      waypoints: edgeWaypoints(layout, edge.id),
    };
    return {
      id: edge.id,
      source: edge.from_node,
      target: edge.to_node,
      sourceHandle: edge.from_port,
      targetHandle: edge.to_port,
      type: 'program',
      data: data as unknown as Record<string, unknown>,
    };
  });

  const positions = Object.fromEntries(
    Object.entries(layout.nodes).map(([id, entry]) => [id, { x: entry.x, y: entry.y }]),
  );
  return {
    nodes: layoutProgramGraph(rawNodes, edges, positions),
    edges,
  };
}

function ProgramCanvasInner({ host }: ViewRenderProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [programs, setPrograms] = useState<ProgramListItem[]>([]);
  const [starters, setStarters] = useState<ProgramDefinition[]>([]);
  const [bindingPresets, setBindingPresets] = useState<ProgramBindingPreset[]>([]);
  const [programId, setProgramId] = useState<string | null>(null);
  const [definition, setDefinition] = useState<ProgramDefinition>(() => emptyDraft(''));
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [boundaryShape, setBoundaryShape] = useState<string | undefined>();
  const [paletteEntries, setPaletteEntries] = useState<CatalogEntry[] | null>(null);
  const [pendingConnect, setPendingConnect] = useState<{
    source: string;
    sourceHandle: string;
  } | null>(null);
  const [dropPoint, setDropPoint] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [livenessByNode, setLivenessByNode] = useState<Record<string, ProcessLiveness>>({});
  const [runReceipt, setRunReceipt] = useState<ProgramRunReceipt | null>(null);
  const [runInvocationId, setRunInvocationId] = useState<string | null>(null);
  const [tweaksByNode, setTweaksByNode] = useState<Record<string, string>>({});
  /**
   * Widget values, keyed node -> port. Kept apart from the raw JSON tweak text
   * so a reader can use either without one clobbering the other; they merge at
   * run time in `optionsForRun`.
   */
  const [widgetTweaks, setWidgetTweaks] = useState<Record<string, Record<string, unknown>>>({});
  const [pinnedByNode, setPinnedByNode] = useState<Record<string, PinnedNodeValue>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  /** Interior content ids waiting to become the Compound pin after an interior save. */
  const [pendingPinByNode, setPendingPinByNode] = useState<Record<string, string>>({});
  const [proposal, setProposal] = useState<CompilerProposal | null>(null);
  const [proposalDiff, setProposalDiff] = useState<ProgramDiff | null>(null);
  /** Positions, collapse, advanced-port state, and reroute waypoints. */
  const [layoutDoc, setLayoutDoc] = useState<CanvasLayoutDocument>(EMPTY_LAYOUT);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programIdRef = useRef(programId);
  const definitionRef = useRef(definition);
  const edgesRef = useRef(edges);
  const nodesRef = useRef(nodes);
  const layoutRef = useRef(layoutDoc);
  /**
   * Bumped whenever the open draft changes identity: opening a program,
   * forking, starting from a starter, materializing a proposal, or resetting to
   * a new draft. Every async completion captures it and drops its result if it
   * no longer matches, so a save, load or edge validation belonging to the
   * program the reader just left cannot write over the one they are in.
   */
  const draftGeneration = useRef(0);
  const catalogById = useMemo(
    () => new Map(catalog.map((entry) => [entry.id, entry])),
    [catalog],
  );

  useEffect(() => {
    programIdRef.current = programId;
  }, [programId]);

  useEffect(() => {
    definitionRef.current = definition;
  }, [definition]);

  useEffect(() => {
    layoutRef.current = layoutDoc;
  }, [layoutDoc]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    void Promise.all([
      fetchProgramContext(),
      fetchProgramCatalog(),
      listPrograms(),
      fetchStarterPrograms(),
      fetchBindingPresets(),
    ])
      .then(([context, entries, items, starterPrograms, presets]) => {
        setTenantId(context.tenantId);
        setCatalog(entries);
        setPrograms(items);
        setStarters(starterPrograms);
        setBindingPresets(presets);
        setDefinition((current) => current.tenant_id
          ? current
          : emptyDraft(context.tenantId));
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
  }, []);

  const scheduleSave = useCallback((
    next: ProgramDefinition,
    layout: CanvasLayoutDocument,
    targetProgramId: string | null = programIdRef.current,
  ) => {
    if (!next.tenant_id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const generation = draftGeneration.current;
    saveTimer.current = setTimeout(() => {
      void saveProgramDraft(next, toLayoutWire(layout), targetProgramId ?? undefined)
        .then((result) => {
          if (generation !== draftGeneration.current) return;
          const id = typeof result.node_id === 'string'
            ? result.node_id
            : typeof result.id === 'string'
              ? result.id
              : typeof result.program_id === 'string'
                ? result.program_id
                : null;
          if (id) {
            programIdRef.current = id;
            setProgramId(id);
          }
          const contentId = typeof result.content_id === 'string' ? result.content_id : null;
          const expandedFrom = next.metadata?.expanded_from_node_id;
          if (
            contentId
            && typeof expandedFrom === 'string'
            && typeof next.parent_program_id === 'string'
            && next.parent_program_id
          ) {
            setPendingPinByNode((current) => ({ ...current, [expandedFrom]: contentId }));
          }
          setNotice('Draft saved');
        })
        .catch((saveError: unknown) => {
          setError(saveError instanceof Error ? saveError.message : String(saveError));
        });
    }, 400);
  }, []);

  /**
   * Fold the current React Flow geometry back into the layout document and
   * save. Everything non-positional -- collapse, advanced-port state, reroute
   * waypoints -- is carried forward from the live document rather than
   * re-derived from node data, which is what stops a bypass toggle from
   * quietly discarding a reader's collapsed nodes and rerouted wires.
   */
  const persistFromFlow = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    let layout = layoutRef.current;
    const liveIds = new Set(nextNodes.map((node) => node.id));
    for (const node of nextNodes) {
      layout = withNodeLayout(layout, node.id, { x: node.position.x, y: node.position.y });
    }
    // Drop layout for nodes that no longer exist so a deleted node cannot
    // resurrect its arrangement if its id is reused.
    const prunedNodes = Object.fromEntries(
      Object.entries(layout.nodes).filter(([nodeId]) => liveIds.has(nodeId)),
    );
    const liveEdgeIds = new Set(nextEdges.map((edge) => edge.id));
    const prunedEdges = Object.fromEntries(
      Object.entries(layout.edges).filter(([edgeId]) => liveEdgeIds.has(edgeId)),
    );
    layout = { ...layout, nodes: prunedNodes, edges: prunedEdges };
    layoutRef.current = layout;
    setLayoutDoc(layout);

    const currentDefinition = definitionRef.current;
    const liveNodeIds = new Set(nextNodes.map((node) => node.id));
    const nextDefinition: ProgramDefinition = {
      ...currentDefinition,
      nodes: currentDefinition.nodes.filter((node) => liveNodeIds.has(node.id)),
      edges: nextEdges.map((edge) => ({
        id: edge.id,
        from_node: edge.source,
        from_port: String(edge.sourceHandle ?? 'out'),
        to_node: edge.target,
        to_port: String(edge.targetHandle ?? 'in'),
      })),
      metadata: { ...currentDefinition.metadata, draft: true },
    };
    definitionRef.current = nextDefinition;
    setDefinition(nextDefinition);
    scheduleSave(nextDefinition, layout);
  }, [scheduleSave]);

  /** Apply a layout-only change: no definition edit, no content identity. */
  const patchLayout = useCallback(
    (mutate: (layout: CanvasLayoutDocument) => CanvasLayoutDocument) => {
      const next = mutate(layoutRef.current);
      layoutRef.current = next;
      setLayoutDoc(next);
      scheduleSave(definitionRef.current, next);
      return next;
    },
    [scheduleSave],
  );

  const toggleNodeCollapsed = useCallback((nodeId: string): void => {
    const next = patchLayout((layout) =>
      withNodeLayout(layout, nodeId, { collapsed: !layout.nodes[nodeId]?.collapsed }));
    setNodes((current) => current.map((node) => node.id === nodeId
      ? { ...node, data: { ...node.data, collapsed: next.nodes[nodeId]?.collapsed } }
      : node));
  }, [patchLayout]);

  const toggleNodeAdvanced = useCallback((nodeId: string): void => {
    const next = patchLayout((layout) =>
      withNodeLayout(layout, nodeId, { advancedOpen: !layout.nodes[nodeId]?.advancedOpen }));
    setNodes((current) => current.map((node) => node.id === nodeId
      ? { ...node, data: { ...node.data, advancedOpen: next.nodes[nodeId]?.advancedOpen } }
      : node));
  }, [patchLayout]);

  const setWidgetTweak = useCallback(
    (nodeId: string, portId: string, value: unknown): void => {
      setWidgetTweaks((current) => {
        const next = { ...current, [nodeId]: { ...current[nodeId], [portId]: value } };
        setNodes((liveNodes) => liveNodes.map((node) => node.id === nodeId
          ? { ...node, data: { ...node.data, tweaks: next[nodeId] } }
          : node));
        return next;
      });
    },
    [],
  );

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    const removedNodeIds = new Set(
      changes.flatMap((change) => change.type === 'remove' ? [change.id] : []),
    );
    setNodes((current) => {
      const next = applyNodeChanges(changes, current);
      const nextEdges = removedNodeIds.size === 0
        ? edges
        : edges.filter((edge) =>
          !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target));
      persistFromFlow(next, nextEdges);
      return next;
    });
    if (removedNodeIds.size > 0) {
      setEdges((current) => current.filter((edge) =>
        !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)));
    }
  }, [edges, persistFromFlow]);

  /**
   * The edges array is controlled, so without this a reader could select a wire
   * and press delete with nothing happening: React Flow had no way to tell the
   * view its edge set changed, leaving no way to correct a wire short of
   * deleting one of the nodes it joins.
   */
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((current) => {
      const next = applyEdgeChanges(changes, current);
      if (next.length !== current.length) {
        // A removal also drops the edge's reroute waypoints, which are keyed by
        // edge id and would otherwise outlive the wire they belong to.
        persistFromFlow(nodesRef.current, next);
      }
      return next;
    });
  }, [persistFromFlow]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (
      !connection.source
      || !connection.target
      || connection.source === connection.target
      || !connection.sourceHandle
      || !connection.targetHandle
    ) {
      return false;
    }
    const source = nodes.find((node) => node.id === connection.source)?.data as unknown as ProgramNodeData | undefined;
    const target = nodes.find((node) => node.id === connection.target)?.data as unknown as ProgramNodeData | undefined;
    const producer = source?.outputs.find((port) => port.id === connection.sourceHandle);
    const consumer = target?.inputs.find((port) => port.id === connection.targetHandle);
    return typesCompatibleClient(producer?.shape, consumer?.shape);
  }, [nodes]);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (
      !connection.source
      || !connection.target
      || !connection.sourceHandle
      || !connection.targetHandle
    ) {
      setError('Connection requires a source port and target port.');
      return;
    }

    const source = definition.nodes.find((node) => node.id === connection.source);
    const target = definition.nodes.find((node) => node.id === connection.target);
    const producer = source?.outputs.find((port) => port.id === connection.sourceHandle);
    const consumer = target?.inputs.find((port) => port.id === connection.targetHandle);
    if (!producer || !consumer) {
      setError('Connection ports could not be resolved from the program definition.');
      return;
    }

    const generation = draftGeneration.current;
    void validateEdgeSchema(producer, consumer)
      .then((validation) => {
        if (generation !== draftGeneration.current) return;
        if (validation.status === 'mismatch') {
          setError(schemaMismatchMessage(validation.mismatch!));
          return;
        }
        setError(null);
        setEdges((current) => {
          const next = [
            ...current,
            {
              ...connection,
              id: `e_${connection.source}_${connection.target}_${Date.now()}`,
              type: 'program',
              data: {
                palette: 'program',
                family: shapeClassFor(producer.shape_id),
                // The server is the authority on schema fit; an undetermined
                // verdict is stated on the wire rather than assumed compatible.
                ...(validation.status === 'undetermined'
                  ? { note: 'schema unknown' }
                  : {}),
              } satisfies SubstrateEdgeData,
            },
          ];
          persistFromFlow(nodes, next);
          return next;
        });
      })
      .catch((validationError: unknown) => {
        setError(
          `Connection could not be validated by the program schema service: ${
            validationError instanceof Error ? validationError.message : String(validationError)
          }`,
        );
      });
  }, [definition.nodes, nodes, persistFromFlow]);

  const onConnectEnd: OnConnectEnd = useCallback((event, state) => {
    if (state.toNode) return;
    const fromNodeId = state.fromNode?.id;
    const fromHandleId = state.fromHandle?.id;
    if (!fromNodeId || !fromHandleId) return;
    const sourceNode = definition.nodes.find((node) => node.id === fromNodeId);
    const port = sourceNode?.outputs.find((item) => item.id === fromHandleId)
      ?? sourceNode?.inputs.find((item) => item.id === fromHandleId);
    if (!port) return;
    const clientX = 'clientX' in event ? event.clientX : 120;
    const clientY = 'clientY' in event ? event.clientY : 120;
    setDropPoint(screenToFlowPosition({ x: clientX, y: clientY }));
    setPendingConnect({ source: fromNodeId, sourceHandle: fromHandleId });
    setBoundaryShape(port.shape_id);
    setBusy(true);
    void validNext({
      inputs: [],
      outputs: [{ id: port.id, shape_id: port.shape_id }],
    })
      .then((entries) => {
        setPaletteEntries(entries);
        setPaletteOpen(true);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        setPaletteEntries(catalog);
        setPaletteOpen(true);
      })
      .finally(() => setBusy(false));
  }, [catalog, definition.nodes, screenToFlowPosition]);

  function toggleNodeFlag(nodeId: string, flag: 'bypassed' | 'muted'): void {
    const nextDefinition: ProgramDefinition = {
      ...definition,
      nodes: definition.nodes.map((node) => node.id === nodeId
        ? { ...node, [flag]: !node[flag] }
        : node),
      metadata: { ...definition.metadata, draft: true },
    };
    const nextNodes = nodes.map((node) => node.id === nodeId
      ? {
          ...node,
          data: {
            ...(node.data as unknown as ProgramNodeData),
            [flag]: !Boolean((node.data as unknown as ProgramNodeData)[flag]),
          },
        }
      : node);
    setDefinition(nextDefinition);
    definitionRef.current = nextDefinition;
    setNodes(nextNodes);
    // Save against the live layout document, not a positions-only object:
    // rebuilding the layout here is what used to discard collapse and grouping.
    scheduleSave(nextDefinition, layoutRef.current);
  }

  const nodeHandlers: NodeHandlers = useMemo(() => ({
    onToggleCollapsed: toggleNodeCollapsed,
    onToggleAdvanced: toggleNodeAdvanced,
    onToggleFlag: (nodeId, flag) => toggleNodeFlag(nodeId, flag),
    onTweakChange: setWidgetTweak,
  // toggleNodeFlag closes over `definition`/`nodes` by design: it is a
  // definition edit, unlike the layout-only toggles beside it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [toggleNodeCollapsed, toggleNodeAdvanced, setWidgetTweak, definition, nodes]);

  /** Shape-class family behind a port, for the drag preview and dimming. */
  const familyForHandle = useCallback(
    (nodeId: string, handleId: string | null): EdgeFamily | undefined => {
      if (!handleId) return undefined;
      const node = definition.nodes.find((candidate) => candidate.id === nodeId);
      const port = node?.outputs.find((candidate) => candidate.id === handleId)
        ?? node?.inputs.find((candidate) => candidate.id === handleId);
      return port ? shapeClassFor(port.shape_id) : undefined;
    },
    [definition.nodes],
  );

  const ConnectionLine = useMemo(
    () => makeConnectionLine(familyForHandle),
    [familyForHandle],
  );

  /**
   * Edges whose producer is running, with the animation budget applied. An edge
   * marches only if its producer is live and it won a slot; past the cap and
   * under reduced motion the wire keeps the width bump and holds still.
   */
  const renderedEdges = useMemo(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const running = edges.filter((edge) => livenessByNode[edge.source] === 'running');
    const marching = marchingEdgeIds(running.map((edge) => edge.id), { reducedMotion });
    const runningIds = new Set(running.map((edge) => edge.id));
    return edges.map((edge) => {
      const isRunning = runningIds.has(edge.id);
      const waypoints = edgeWaypoints(layoutDoc, edge.id);
      const data = edge.data as SubstrateEdgeData | undefined;
      return {
        ...edge,
        data: {
          ...data,
          waypoints,
          running: isRunning,
          marching: marching.has(edge.id),
          onWaypointMove: (index: number, point: { x: number; y: number }) => {
            patchLayout((layout) =>
              withEdgeWaypoints(layout, edge.id, moveWaypoint(edgeWaypoints(layout, edge.id), index, point)));
          },
          onWaypointRemove: (index: number) => {
            patchLayout((layout) =>
              withEdgeWaypoints(layout, edge.id, removeWaypoint(edgeWaypoints(layout, edge.id), index)));
          },
        } as unknown as Record<string, unknown>,
      };
    });
  }, [edges, layoutDoc, livenessByNode, patchLayout]);

  function programIdentityForCompound(): string {
    if (programId) return programId;
    throw new Error('Save or open a program before compound mutations.');
  }

  async function applyCompoundExterior(
    next: ProgramDefinition,
    nextProgramId: string,
    noticeText: string,
  ): Promise<void> {
    setDefinition(next);
    setProgramId(nextProgramId);
    const flow = definitionToFlow(next, catalogById, layoutRef.current, nodeHandlers, widgetTweaks);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setNotice(noticeText);
  }

  async function expandSelectedNode(): Promise<void> {
    if (!selectedNodeId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await expandProgramNode({
        programId: programIdentityForCompound(),
        nodeId: selectedNodeId,
      });
      await applyCompoundExterior(
        result.program,
        result.node_id || programIdentityForCompound(),
        `Expanded ${selectedNodeId} into a Compound.`,
      );
    } catch (expandError) {
      setError(expandError instanceof Error ? expandError.message : String(expandError));
    } finally {
      setBusy(false);
    }
  }

  async function collapseSelectedNode(): Promise<void> {
    if (!selectedNodeId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await collapseProgramNode({
        programId: programIdentityForCompound(),
        nodeId: selectedNodeId,
      });
      setPendingPinByNode((current) => {
        const next = { ...current };
        delete next[selectedNodeId];
        return next;
      });
      await applyCompoundExterior(
        result.program,
        result.node_id || programIdentityForCompound(),
        `Collapsed ${selectedNodeId} to a Rule.`,
      );
    } catch (collapseError) {
      setError(collapseError instanceof Error ? collapseError.message : String(collapseError));
    } finally {
      setBusy(false);
    }
  }

  async function openSelectedInterior(): Promise<void> {
    if (!selectedNodeId) return;
    setError(null);
    try {
      const interior = await fetchProgramInterior({
        programId: programIdentityForCompound(),
        nodeId: selectedNodeId,
      });
      await openProgram(interior.pinned_content_id || interior.interior_program_id);
      setNotice(`Opened interior for ${selectedNodeId}.`);
    } catch (interiorError) {
      setError(interiorError instanceof Error ? interiorError.message : String(interiorError));
    }
  }

  async function advanceSelectedPin(): Promise<void> {
    if (!selectedNodeId) return;
    const toContentId = pendingPinByNode[selectedNodeId];
    if (!toContentId) {
      setNotice(`No newer interior content for ${selectedNodeId}; edit and save the interior first.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await advanceProgramPin({
        programId: programIdentityForCompound(),
        nodeId: selectedNodeId,
        toContentId,
      });
      setPendingPinByNode((current) => {
        const next = { ...current };
        delete next[selectedNodeId];
        return next;
      });
      await applyCompoundExterior(
        result.program,
        result.node_id || programIdentityForCompound(),
        `Advanced pin on ${selectedNodeId}.`,
      );
    } catch (advanceError) {
      setError(advanceError instanceof Error ? advanceError.message : String(advanceError));
    } finally {
      setBusy(false);
    }
  }

  async function openProgram(id: string): Promise<void> {
    draftGeneration.current += 1;
    const generation = draftGeneration.current;
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadProgram(id);
      // The reader may have opened something else while this was in flight.
      if (generation !== draftGeneration.current) return;
      setProgramId(id);
      setDefinition(loaded.definition);
      const loadedLayout = fromLayoutWire(loaded.layout as never);
      layoutRef.current = loadedLayout;
      setLayoutDoc(loadedLayout);
      const flow = definitionToFlow(loaded.definition, catalogById, loadedLayout, nodeHandlers, widgetTweaks);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      resetRunState();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setBusy(false);
    }
  }

  async function insertEntry(entry: CatalogEntry): Promise<void> {
    const id = `node:${crypto.randomUUID()}`;
    const position = dropPoint ?? { x: 80 + nodes.length * 40, y: 80 };
    let programNode: ProgramDefinition['nodes'][number];
    try {
      programNode = programNodeFromCatalog(entry, id);
    } catch (insertError) {
      setError(insertError instanceof Error ? insertError.message : String(insertError));
      return;
    }
    const data: ProgramNodeData = {
      label: entry.class_name ?? entry.id,
      catalogId: entry.id,
      kind: programNode.kind,
      inputs: programNode.inputs.map((port) => ({ id: port.id, shape: port.shape_id })),
      outputs: programNode.outputs.map((port) => ({ id: port.id, shape: port.shape_id })),
      catalog: entry,
      lifecycle: entry.lifecycle,
      bypassed: false,
      muted: false,
      station: programNode.station ?? undefined,
      connectedInputs: [],
      tweaks: {},
      onToggleCollapsed: () => nodeHandlers.onToggleCollapsed(id),
      onToggleAdvanced: () => nodeHandlers.onToggleAdvanced(id),
      onToggleFlag: (flag) => nodeHandlers.onToggleFlag(id, flag),
      onTweakChange: (portId, value) => nodeHandlers.onTweakChange(id, portId, value),
    };
    const nextNodes: Node[] = [
      ...nodes,
      {
        id,
        type: PROGRAM_NODE_KIND,
        position,
        data: data as unknown as Record<string, unknown>,
      },
    ];
    let nextEdges = edges;
    let nextProgramEdges = definition.edges;
    try {
      if (pendingConnect) {
      const producerNode = definition.nodes.find((node) => node.id === pendingConnect.source);
      const producer = producerNode?.outputs.find((port) => port.id === pendingConnect.sourceHandle);
        const consumer = programNode.inputs[0];
        if (!producer || !consumer) {
          throw new Error('Selected catalog node has no compatible input boundary.');
        }
        const validation = await validateEdgeSchema(producer, consumer);
        if (validation.status === 'mismatch') {
          throw new Error(schemaMismatchMessage(validation.mismatch!));
        }
        const edgeId = `edge:${crypto.randomUUID()}`;
        nextEdges = [
          ...edges,
          {
            id: edgeId,
            source: pendingConnect.source,
            target: id,
            sourceHandle: pendingConnect.sourceHandle,
            targetHandle: consumer.id,
            type: 'program' as const,
            data: {
              palette: 'program',
              family: shapeClassFor(producer.shape_id),
              ...(validation.status === 'undetermined'
                ? { note: 'schema unknown' }
                : {}),
            } satisfies SubstrateEdgeData,
          },
        ];
        nextProgramEdges = [
          ...definition.edges,
          {
            id: edgeId,
            from_node: pendingConnect.source,
            from_port: pendingConnect.sourceHandle,
            to_node: id,
            to_port: consumer.id,
          },
        ];
      }
      const nextDefinition: ProgramDefinition = {
        ...definition,
        nodes: [...definition.nodes, programNode],
        edges: nextProgramEdges,
        metadata: {
          ...definition.metadata,
          draft: true,
          ...(entry.authoring_runtime
            ? {
                code_nodes: {
                  ...(
                    definition.metadata.code_nodes
                    && typeof definition.metadata.code_nodes === 'object'
                    && !Array.isArray(definition.metadata.code_nodes)
                      ? definition.metadata.code_nodes as Record<string, JsonValue>
                      : {}
                  ),
                  [id]: {
                    runtime: entry.authoring_runtime,
                    source: entry.authoring_runtime === 'quick_js'
                      ? 'return input;'
                      : `(module
  (import "extism:host/env" "input_offset" (func $input_offset (result i64)))
  (import "extism:host/env" "length" (func $length (param i64) (result i64)))
  (import "extism:host/env" "output_set" (func $output_set (param i64 i64)))
  (func (export "run") (result i32)
    (local $input i64)
    (local.set $input (call $input_offset))
    (call $output_set (local.get $input) (call $length (local.get $input)))
    (i32.const 0)
  )
)`,
                    ...(entry.authoring_runtime === 'wasm' ? { export: 'run' } : {}),
                    ...(entry.contract ? { contract_id: entry.contract.id } : {}),
                  },
                },
              }
            : {}),
        },
      };
      definitionRef.current = nextDefinition;
      setDefinition(nextDefinition);
      setNodes(nextNodes);
      setEdges(nextEdges);
      scheduleSave(nextDefinition, layoutRef.current);
      setError(null);
    } catch (insertError) {
      setError(insertError instanceof Error ? insertError.message : String(insertError));
    } finally {
      setPaletteOpen(false);
      setBoundaryShape(undefined);
      setPaletteEntries(null);
      setPendingConnect(null);
      setDropPoint(null);
    }
  }

  function optionsForRun(
    invocationId: string,
    humanAnswers: Record<string, JsonValue> = {},
  ): ProgramRunOptions {
    const tweaks: Record<string, JsonValue> = {};
    // Widget values first, then the raw JSON tweak text, so a reader who opens
    // the tweak editor and writes a whole object still wins over the inline
    // controls for the keys they named.
    for (const [nodeId, ports] of Object.entries(widgetTweaks)) {
      const set = Object.entries(ports).filter(([, value]) => value !== undefined && value !== '');
      if (set.length === 0) continue;
      tweaks[nodeId] = Object.fromEntries(set) as JsonValue;
    }
    for (const [nodeId, source] of Object.entries(tweaksByNode)) {
      if (!source.trim()) continue;
      let parsed: JsonValue;
      try {
        parsed = JSON.parse(source) as JsonValue;
      } catch {
        throw new Error(`Tweak for ${nodeId} is not valid JSON.`);
      }
      const existing = tweaks[nodeId];
      tweaks[nodeId] =
        existing && typeof existing === 'object' && !Array.isArray(existing) &&
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? { ...existing, ...parsed }
          : parsed;
    }
    return {
      invocation_id: invocationId,
      inputs: {},
      tweaks,
      pinned_nodes: pinnedByNode,
      human_answers: humanAnswers,
      environment_store: {},
    };
  }

  function applyReceipt(receipt: ProgramRunReceipt): void {
    let nextLiveness: Record<string, ProcessLiveness> = {};
    const latestEvent = new Map<string, ProgramRunReceipt['events'][number]>();
    for (const event of receipt.events) {
      nextLiveness = applyRunEvent(nextLiveness, event);
      latestEvent.set(event.node_id, event);
    }
    for (const [nodeId, liveness] of Object.entries(receipt.final_liveness)) {
      nextLiveness[nodeId] = liveness;
    }
    setRunReceipt(receipt);
    setLivenessByNode(nextLiveness);
    setNodes((current) => current.map((node) => {
      const inspection = receipt.inspections[node.id];
      const event = latestEvent.get(node.id);
      return {
        ...node,
        data: {
          ...(node.data as unknown as ProgramNodeData),
          liveness: nextLiveness[node.id],
          pinned: inspection?.pinned ?? Boolean(pinnedByNode[node.id]),
          stale: inspection?.stale ?? false,
          eventLabel: event?.status ?? event?.kind,
        },
      };
    }));
    setNotice(`Run ${receipt.run_id}: ${receipt.events.length} server events.`);
  }

  async function runProgram(): Promise<void> {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const invocationId = crypto.randomUUID();
      setRunInvocationId(invocationId);
      applyReceipt(await runProgramDefinition(definition, optionsForRun(invocationId)));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setBusy(false);
    }
  }

  async function resumeRun(answer: string): Promise<void> {
    if (!runReceipt?.parked || !runInvocationId) return;
    setBusy(true);
    setError(null);
    try {
      applyReceipt(await resumeProgramDefinition(
        definition,
        optionsForRun(runInvocationId, { [runReceipt.parked.node_id]: answer }),
        runReceipt.parked.resume_token,
      ));
    } catch (resumeError) {
      setError(resumeError instanceof Error ? resumeError.message : String(resumeError));
    } finally {
      setBusy(false);
    }
  }

  async function pinSelectedValue(value: ProgramValueRef): Promise<void> {
    if (!selectedNodeId) return;
    const valueHash = value.storage === 'spilled'
      ? value.digest
      : Array.from(new Uint8Array(await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(JSON.stringify(value.value)),
        )))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
    setPinnedByNode((current) => ({
      ...current,
      [selectedNodeId]: {
        value,
        value_hash: valueHash,
        pinned_at_ms: Date.now(),
      },
    }));
    setNodes((current) => current.map((node) => node.id === selectedNodeId
      ? {
          ...node,
          data: { ...(node.data as unknown as ProgramNodeData), pinned: true, stale: true },
        }
      : node));
    setNotice(`Pinned ${selectedNodeId}. The next run will serve its stale value.`);
  }

  const applyBindingStation = useCallback(async (
    preset: ProgramBindingPreset,
    nodeId: string,
  ): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }

      let targetProgramId = programIdRef.current;
      if (!targetProgramId) {
        const saved = await saveProgramDraft(
          definitionRef.current,
          toLayoutWire(layoutRef.current),
        );
        targetProgramId = typeof saved.node_id === 'string'
          ? saved.node_id
          : typeof saved.id === 'string'
            ? saved.id
            : typeof saved.program_id === 'string'
              ? saved.program_id
              : null;
        if (!targetProgramId) {
          throw new Error('station_drop_program_id_missing');
        }
        programIdRef.current = targetProgramId;
        setProgramId(targetProgramId);
      }

      const receipt = await dropBindingPreset({
        programId: targetProgramId,
        nodeId,
        presetId: preset.preset_id,
      });
      const currentDefinition = definitionRef.current;
      const nextDefinition: ProgramDefinition = {
        ...currentDefinition,
        nodes: currentDefinition.nodes.map((node) => node.id === nodeId
          ? { ...node, station: receipt.station }
          : node),
        metadata: { ...currentDefinition.metadata, draft: true },
      };
      definitionRef.current = nextDefinition;
      setDefinition(nextDefinition);
      setNodes((current) => current.map((node) => node.id === nodeId
        ? {
            ...node,
            data: {
              ...(node.data as unknown as ProgramNodeData),
              station: receipt.station,
            },
          }
        : node));
      scheduleSave(nextDefinition, layoutRef.current, targetProgramId);
      setNotice(`Applied ${preset.display_name} to ${nodeId}.`);
    } catch (stationError) {
      setError(stationError instanceof Error ? stationError.message : String(stationError));
    } finally {
      setBusy(false);
    }
  }, [scheduleSave]);

  const onBindingStationDrop = useCallback((
    event: ReactDragEvent<HTMLDivElement>,
  ): void => {
    const presetId = event.dataTransfer.getData(BINDING_PRESET_DRAG_TYPE);
    if (!presetId) return;
    event.preventDefault();
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('.react-flow__node')
      : null;
    const nodeId = target?.dataset.id;
    const preset = bindingPresets.find((candidate) => candidate.preset_id === presetId);
    if (!nodeId || !preset) {
      setError('Drop a binding station directly onto a program node.');
      return;
    }
    void applyBindingStation(preset, nodeId);
  }, [applyBindingStation, bindingPresets]);

  async function publishSelected(): Promise<void> {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      // PG9: never fabricate attestation bytes. Host must supply a signed principal attestation.
      const hostAttestation = (host as { publicationAttestation?: {
        identity: string;
        signature: number[];
        public_key: number[];
      } }).publicationAttestation;
      if (!hostAttestation) {
        throw new Error(
          'publication_attestation_unavailable: BlockHost must supply a signed principal attestation before publish',
        );
      }
      const nodeIds = selectedNodeId
        ? [selectedNodeId]
        : definition.nodes.map((node) => node.id);
      const receipt = await publishSubgraph({
        definition,
        nodeIds,
        principal: hostAttestation.identity,
        attestation: hostAttestation,
      });
      setNotice(`Published block ${String(receipt.block_id ?? receipt.program_id ?? 'ok')}`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
    } finally {
      setBusy(false);
    }
  }

  async function forkProgram(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      draftGeneration.current += 1;
      const forked = await forkProgramDefinition(
        definition,
        `Fork of ${definition.name}`,
        definition.intent,
      );
      setProgramId(null);
      setDefinition(forked);
      layoutRef.current = EMPTY_LAYOUT;
      setLayoutDoc(EMPTY_LAYOUT);
      const flow = definitionToFlow(forked, catalogById, EMPTY_LAYOUT, nodeHandlers, {});
      setNodes(flow.nodes);
      setEdges(flow.edges);
      resetRunState();
      scheduleSave(forked, layoutRef.current, null);
      setNotice(`Fork opened from ${definition.name}.`);
    } catch (forkError) {
      setError(forkError instanceof Error ? forkError.message : String(forkError));
    } finally {
      setBusy(false);
    }
  }

  async function openProposal(): Promise<void> {
    const intent = definition.intent.trim() || 'Standing program wish';
    const proposed: CompilerProposal = {
      source_intent: intent,
      compiler_id: 'console.program-canvas',
      compiler_receipt_id: `receipt_${Date.now()}`,
      proposed_program: {
        ...definition,
        intent,
        metadata: { ...definition.metadata, draft: true, proposed_via: 'console' },
      },
    };
    setBusy(true);
    try {
      await validateCompilerProposal(proposed);
      setProposal(proposed);
      setProposalDiff(diffPrograms(definition, proposed.proposed_program));
      setNotice('Compiler proposal validated.');
    } catch (proposalError) {
      setError(proposalError instanceof Error ? proposalError.message : String(proposalError));
    } finally {
      setBusy(false);
    }
  }

  async function acceptProposal(): Promise<void> {
    if (!proposal) return;
    const next = proposal.proposed_program;
    setBusy(true);
    setError(null);
    try {
      draftGeneration.current += 1;
      const receipt = await materializeProgram(next, programId);
      setDefinition(next);
      layoutRef.current = EMPTY_LAYOUT;
      setLayoutDoc(EMPTY_LAYOUT);
      const flow = definitionToFlow(next, catalogById, EMPTY_LAYOUT, nodeHandlers, {});
      setNodes(flow.nodes);
      setEdges(flow.edges);
      resetRunState();
      scheduleSave(next, layoutRef.current);
      setProposal(null);
      setProposalDiff(null);
      setNotice(`Proposal materialized: ${String(receipt.program_id ?? receipt.node_id ?? 'accepted')}.`);
    } catch (proposalError) {
      setError(proposalError instanceof Error ? proposalError.message : String(proposalError));
    } finally {
      setBusy(false);
    }
  }

  function autoLayout(): void {
    const laid = layoutProgramGraph(nodes, edges, {});
    setNodes(laid);
    persistFromFlow(laid, edges);
    setNotice('Dagre layout applied; positions persist as program.layout.');
  }

  function resetRunState(): void {
    setRunReceipt(null);
    setRunInvocationId(null);
    setLivenessByNode({});
    setTweaksByNode({});
    setWidgetTweaks({});
    setPinnedByNode({});
    setSelectedNodeId(null);
  }

  function openStarter(starter: ProgramDefinition): void {
    draftGeneration.current += 1;
    if (!tenantId) return;
    const next: ProgramDefinition = {
      ...starter,
      tenant_id: tenantId,
      name: `Fork of ${starter.name}`,
      metadata: { ...starter.metadata, draft: true, starter_name: starter.name },
    };
    layoutRef.current = EMPTY_LAYOUT;
    setLayoutDoc(EMPTY_LAYOUT);
    const flow = definitionToFlow(next, catalogById, EMPTY_LAYOUT, nodeHandlers, {});
    setProgramId(null);
    setDefinition(next);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    resetRunState();
    scheduleSave(next, layoutRef.current, null);
    setNotice(`Started from ${starter.name}.`);
  }

  function updateCodeSource(nodeId: string, source: string): void {
    const currentCodeNodes = definition.metadata.code_nodes
      && typeof definition.metadata.code_nodes === 'object'
      && !Array.isArray(definition.metadata.code_nodes)
      ? definition.metadata.code_nodes as Record<string, JsonValue>
      : {};
    const currentNode = currentCodeNodes[nodeId]
      && typeof currentCodeNodes[nodeId] === 'object'
      && !Array.isArray(currentCodeNodes[nodeId])
      ? currentCodeNodes[nodeId] as Record<string, JsonValue>
      : {};
    const next: ProgramDefinition = {
      ...definition,
      metadata: {
        ...definition.metadata,
        draft: true,
        code_nodes: {
          ...currentCodeNodes,
          [nodeId]: { ...currentNode, source },
        },
      },
    };
    setDefinition(next);
    scheduleSave(next, layoutRef.current);
  }

  return (
    <div className="h-full min-h-0" data-program-canvas>
      <BlockShell
      material="sunken"
      title="Program"
      scope={programId ? <span className="font-ij-mono" data-mono-ok>{programId}</span> : 'Draft'}
      count={`${catalog.length} ops`}
      degradation={error ? degradationFor(error, 500) : null}
      controlRow={(
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-ij-ink-info">
            Program
            <select
              className="h-ij-control rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
              value={programId ?? ''}
              onChange={(event) => {
                const id = event.target.value;
                if (id) {
                  void openProgram(id);
                } else if (tenantId) {
                  draftGeneration.current += 1;
                  setProgramId(null);
                  setDefinition(emptyDraft(tenantId));
                  setNodes([]);
                  setEdges([]);
                  resetRunState();
                }
              }}
            >
              <option value="">New draft</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name ?? program.id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3"
            onClick={() => {
              setBoundaryShape(undefined);
              setPaletteEntries(null);
              setPendingConnect(null);
              setPaletteOpen(true);
            }}
          >
            Add node
          </button>
          <button
            type="button"
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3"
            onClick={autoLayout}
          >
            Layout
          </button>
          <button
            type="button"
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3"
            disabled={busy || definition.nodes.length === 0}
            onClick={() => void forkProgram()}
          >
            Fork
          </button>
          <button
            type="button"
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3"
            disabled={busy}
            onClick={() => void openProposal()}
          >
            Propose
          </button>
          <button
            type="button"
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3"
            disabled={
              busy
              || definition.nodes.length === 0
              || !('publicationAttestation' in host)
            }
            title={'publicationAttestation' in host
              ? 'Publish selected nodes as a signed block'
              : 'Publish unavailable: the authenticated host has no signing attestation'}
            onClick={() => void publishSelected()}
          >
            Publish
          </button>
          {notice ? <span className="text-xs text-ij-ink-info">{notice}</span> : null}
        </div>
      )}
      className="bg-transparent text-ij-ink"
    >
      <div className="relative flex h-full min-h-96">
        <BindingStationTray
          presets={bindingPresets}
          selectedNodeId={selectedNodeId}
          busy={busy}
          onApply={(preset, nodeId) => void applyBindingStation(preset, nodeId)}
        />
        <div
          className="relative min-h-96 min-w-0 flex-1"
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes(BINDING_PRESET_DRAG_TYPE)) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={onBindingStationDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={renderedEdges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            connectionLineComponent={ConnectionLine}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onConnectEnd={onConnectEnd}
            onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
            onEdgeDoubleClick={(event, edge) => {
              // Double-click drops a reroute dot where the reader clicked. It
              // is layout, so it never touches the program definition.
              event.stopPropagation();
              const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
              const source = nodes.find((node) => node.id === edge.source);
              const target = nodes.find((node) => node.id === edge.target);
              if (!source || !target) return;
              patchLayout((layout) => withEdgeWaypoints(
                layout,
                edge.id,
                insertWaypoint(source.position, target.position, edgeWaypoints(layout, edge.id), point),
              ));
            }}
            onPaneClick={(event) => {
              setSelectedNodeId(null);
              if (event.detail === 2) {
                // Quick add with no port context: the palette shows the whole
                // catalog, since nothing constrains the boundary here.
                setBoundaryShape(undefined);
                setPaletteEntries(null);
                setPendingConnect(null);
                setDropPoint(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
                setPaletteOpen(true);
              }
            }}
            fitView
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls showInteractive={false} />
            <ConnectionSatisfaction familyForHandle={familyForHandle} />
          </ReactFlow>
          {nodes.length === 0 ? (
            <section className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center" aria-label="Empty program">
              <div className="max-w-sm rounded-ij-arc border border-ij-seam bg-ij-raised px-4 py-3 text-ij-ink">
                <p style={{ fontWeight: 'var(--rec-weight-cap)' }}>Start a standing program</p>
                <p className="mt-1 text-sm text-ij-ink-info">
                  Add a catalog node or open a recent program to compose its graph.
                </p>
                {starters.length ? (
                  <div className="mt-3 grid gap-2">
                    {starters.slice(0, 4).map((starter) => (
                      <button
                        key={`${starter.name}:${starter.intent}`}
                        type="button"
                        onClick={() => openStarter(starter)}
                        className="rounded-ij-arc border border-ij-control-border px-3 py-2 text-left hover:bg-ij-hover-surface"
                      >
                        <span className="block text-sm" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                          {starter.name}
                        </span>
                        <span className="block text-xs text-ij-ink-info">{starter.intent}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {programs.length ? (
                  <p className="mt-2 font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
                    Recent: {programs.slice(0, 3).map((program) => program.name ?? program.id).join(', ')}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}
          <NodePalette
            open={paletteOpen}
            entries={paletteEntries ?? catalog}
            boundaryShape={boundaryShape}
            onSelect={(entry) => void insertEntry(entry)}
            onClose={() => {
              setPaletteOpen(false);
              setPaletteEntries(null);
              setPendingConnect(null);
            }}
          />
          {selectedNodeId ? (
            <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1 rounded-ij-arc border border-ij-seam bg-ij-raised p-1">
              <button
                type="button"
                onClick={() => toggleNodeFlag(selectedNodeId, 'bypassed')}
                className="h-ij-control rounded-ij-arc px-2 text-xs hover:bg-ij-hover-surface"
              >
                {(nodes.find((node) => node.id === selectedNodeId)?.data as unknown as ProgramNodeData | undefined)?.bypassed
                  ? 'Enable node'
                  : 'Bypass node'}
              </button>
              <button
                type="button"
                onClick={() => toggleNodeFlag(selectedNodeId, 'muted')}
                className="h-ij-control rounded-ij-arc px-2 text-xs hover:bg-ij-hover-surface"
              >
                {(nodes.find((node) => node.id === selectedNodeId)?.data as unknown as ProgramNodeData | undefined)?.muted
                  ? 'Unmute node'
                  : 'Mute node'}
              </button>
              {definition.nodes.find((node) => node.id === selectedNodeId)?.kind === 'compound' ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openSelectedInterior()}
                    className="h-ij-control rounded-ij-arc px-2 text-xs hover:bg-ij-hover-surface disabled:opacity-50"
                  >
                    Open interior
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void collapseSelectedNode()}
                    className="h-ij-control rounded-ij-arc px-2 text-xs hover:bg-ij-hover-surface disabled:opacity-50"
                  >
                    Collapse
                  </button>
                  <button
                    type="button"
                    disabled={busy || !pendingPinByNode[selectedNodeId]}
                    onClick={() => void advanceSelectedPin()}
                    className="h-ij-control rounded-ij-arc px-2 text-xs hover:bg-ij-hover-surface disabled:opacity-50"
                    title={pendingPinByNode[selectedNodeId]
                      ? `Advance pin to ${pendingPinByNode[selectedNodeId]}`
                      : 'Edit and save the interior to enable Advance pin'}
                  >
                    Advance pin
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy || !programId}
                  onClick={() => void expandSelectedNode()}
                  className="h-ij-control rounded-ij-arc px-2 text-xs hover:bg-ij-hover-surface disabled:opacity-50"
                >
                  Expand
                </button>
              )}
            </div>
          ) : null}
          <ProposalOverlay
            proposal={proposal}
            diff={proposalDiff}
            onAccept={() => void acceptProposal()}
            onReject={() => {
              setProposal(null);
              setProposalDiff(null);
            }}
          />
        </div>
        <RunRail
          busy={busy}
          livenessByNode={livenessByNode}
          receipt={runReceipt}
          selectedNodeId={selectedNodeId}
          tweakText={selectedNodeId ? tweaksByNode[selectedNodeId] ?? '' : ''}
          pinned={Boolean(selectedNodeId && pinnedByNode[selectedNodeId])}
          authoringRuntime={selectedNodeId
            ? catalogById.get(
                definition.nodes.find((node) => node.id === selectedNodeId)?.block_id ?? '',
              )?.authoring_runtime ?? null
            : null}
          codeSource={selectedNodeId
            && definition.metadata.code_nodes
            && typeof definition.metadata.code_nodes === 'object'
            && !Array.isArray(definition.metadata.code_nodes)
            && typeof (
              definition.metadata.code_nodes as Record<string, unknown>
            )[selectedNodeId] === 'object'
            ? String((
                (
                  definition.metadata.code_nodes as Record<string, unknown>
                )[selectedNodeId] as Record<string, unknown>
              ).source ?? '')
            : ''}
          onTweakTextChange={(value) => {
            if (!selectedNodeId) return;
            setTweaksByNode((current) => ({ ...current, [selectedNodeId]: value }));
          }}
          onCodeSourceChange={(value) => {
            if (selectedNodeId) updateCodeSource(selectedNodeId, value);
          }}
          onRun={() => void runProgram()}
          onPin={(value) => void pinSelectedValue(value)}
          onUnpin={() => {
            if (!selectedNodeId) return;
            setPinnedByNode((current) => {
              const next = { ...current };
              delete next[selectedNodeId];
              return next;
            });
            setNodes((current) => current.map((node) => node.id === selectedNodeId
              ? {
                  ...node,
                  data: { ...(node.data as unknown as ProgramNodeData), pinned: false, stale: false },
                }
              : node));
          }}
          onResume={(answer) => void resumeRun(answer)}
          onFetchSpill={fetchProgramSpill}
          notice={notice}
        />
      </div>
      </BlockShell>
    </div>
  );
}

export function ProgramView(props: ViewRenderProps) {
  return (
    <ReactFlowProvider>
      <ProgramCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
