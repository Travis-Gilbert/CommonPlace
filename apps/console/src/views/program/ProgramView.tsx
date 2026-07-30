'use client';

// SOURCING: @xyflow/react wrap for SPEC-PROGRAM-CANVAS-1.0 ProgramView (PG3-PG6).
// Catalog-driven nodes; MCP catalog/list/load/save/valid_next; no fixture path.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type OnNodesChange,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import type {
  CatalogEntry,
  CompilerProposal,
  JsonValue,
  PinnedNodeValue,
  ProcessLiveness,
  ProgramDefinition,
  ProgramDiff,
  ProgramRunOptions,
  ProgramRunReceipt,
  ProgramValueRef,
} from '@commonplace/program-contracts';
import { BlockShell } from '@/components/block/BlockShell';
import { degradationFor } from '@/lib/degradation';
import { ProgramNodeView, type ProgramNodeData } from './ProgramNodeView';
import { ProgramEdgeView } from './ProgramEdgeView';
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
  fetchProgramCatalog,
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
  type ProgramLayout,
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

const NODE_TYPES: NodeTypes = {
  program: ProgramNodeView,
  placeholder: PlaceholderNode,
};

const EDGE_TYPES: EdgeTypes = {
  program: ProgramEdgeView,
};

function emptyDraft(tenantId: string): ProgramDefinition {
  return {
    tenant_id: tenantId,
    name: 'Untitled program',
    intent: '',
    authority: 'advisory',
    trigger: { kind: 'graph_change', labels: [], properties: [] },
    budget: { max_invocations: 10, window_seconds: 3600, max_cost_microunits: 1 },
    approval: { mode: 'preapproved_within_grants', grant_ids: [] },
    nodes: [],
    edges: [],
    metadata: { draft: true },
  };
}

function definitionToFlow(
  definition: ProgramDefinition,
  catalogById: Map<string, CatalogEntry>,
  layout: ProgramLayout,
  onToggleCollapsed?: (nodeId: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const rawNodes: Node[] = definition.nodes.map((node, index) => {
    const entry = catalogById.get(node.block_id);
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
      collapsed: layout.node_metadata?.[node.id]?.collapsed,
      onToggleCollapsed: onToggleCollapsed ? () => onToggleCollapsed(node.id) : undefined,
    };
    return {
      id: node.id,
      type: entry ? 'program' : 'placeholder',
      position: layout.nodes[node.id] ?? { x: index * 220, y: 40 },
      data: entry
        ? data
        : {
            catalogId: node.block_id,
            refusal: data.refusal,
            inputs: node.inputs.map((port) => port.id),
            outputs: node.outputs.map((port) => port.id),
          },
    };
  });
  const edges: Edge[] = definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.from_node,
    target: edge.to_node,
    sourceHandle: edge.from_port,
    targetHandle: edge.to_port,
    type: 'program',
    data: {
      shapeClass: shapeClassFor('tabular_any'),
      status: 'undetermined' as const,
    },
  }));
  return {
    nodes: layoutProgramGraph(rawNodes, edges, layout.nodes),
    edges,
  };
}

function ProgramCanvasInner({ host }: ViewRenderProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [programs, setPrograms] = useState<ProgramListItem[]>([]);
  const [starters, setStarters] = useState<ProgramDefinition[]>([]);
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
  const [pinnedByNode, setPinnedByNode] = useState<Record<string, PinnedNodeValue>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CompilerProposal | null>(null);
  const [proposalDiff, setProposalDiff] = useState<ProgramDiff | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programIdRef = useRef(programId);
  const definitionRef = useRef(definition);
  const edgesRef = useRef(edges);
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
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    void Promise.all([
      fetchProgramContext(),
      fetchProgramCatalog(),
      listPrograms(),
      fetchStarterPrograms(),
    ])
      .then(([context, entries, items, starterPrograms]) => {
        setTenantId(context.tenantId);
        setCatalog(entries);
        setPrograms(items);
        setStarters(starterPrograms);
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
    layout: ProgramLayout,
    targetProgramId: string | null = programIdRef.current,
  ) => {
    if (!next.tenant_id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveProgramDraft(next, layout, targetProgramId ?? undefined)
        .then((result) => {
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
          setNotice('Draft saved');
        })
        .catch((saveError: unknown) => {
          setError(saveError instanceof Error ? saveError.message : String(saveError));
        });
    }, 400);
  }, []);

  const persistFromFlow = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    const layout: ProgramLayout = {
      nodes: {},
      node_metadata: {},
    };
    for (const node of nextNodes) {
      layout.nodes[node.id] = node.position;
      const data = node.data as Partial<ProgramNodeData>;
      if (data.collapsed || data.groupId) {
        layout.node_metadata![node.id] = {
          ...(data.collapsed ? { collapsed: true } : {}),
          ...(data.groupId ? { group_id: data.groupId } : {}),
        };
      }
    }
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

  const toggleNodeCollapsed = useCallback((nodeId: string): void => {
    setNodes((current) => {
      const next = current.map((node) => node.id === nodeId
        ? {
            ...node,
            data: {
              ...(node.data as ProgramNodeData),
              collapsed: !Boolean((node.data as ProgramNodeData).collapsed),
            },
          }
        : node);
      persistFromFlow(next, edgesRef.current);
      return next;
    });
  }, [persistFromFlow]);

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
    const source = nodes.find((node) => node.id === connection.source)?.data as ProgramNodeData | undefined;
    const target = nodes.find((node) => node.id === connection.target)?.data as ProgramNodeData | undefined;
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

    void validateEdgeSchema(producer, consumer)
      .then((validation) => {
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
                shapeClass: shapeClassFor(producer.shape_id),
                status: validation.status,
              },
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
            ...(node.data as ProgramNodeData),
            [flag]: !Boolean((node.data as ProgramNodeData)[flag]),
          },
        }
      : node);
    setDefinition(nextDefinition);
    setNodes(nextNodes);
    scheduleSave(nextDefinition, { nodes: Object.fromEntries(nextNodes.map((node) => [node.id, node.position])) });
  }

  async function openProgram(id: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadProgram(id);
      setProgramId(id);
      setDefinition(loaded.definition);
      const flow = definitionToFlow(loaded.definition, catalogById, loaded.layout ?? { nodes: {} }, toggleNodeCollapsed);
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
      onToggleCollapsed: () => toggleNodeCollapsed(id),
    };
    const nextNodes = [...nodes, { id, type: 'program' as const, position, data }];
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
              shapeClass: shapeClassFor(producer.shape_id),
              status: validation.status,
            },
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
      setDefinition(nextDefinition);
      setNodes(nextNodes);
      setEdges(nextEdges);
      scheduleSave(nextDefinition, {
        nodes: Object.fromEntries(nextNodes.map((node) => [node.id, node.position])),
      });
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
    for (const [nodeId, source] of Object.entries(tweaksByNode)) {
      if (!source.trim()) continue;
      try {
        tweaks[nodeId] = JSON.parse(source) as JsonValue;
      } catch {
        throw new Error(`Tweak for ${nodeId} is not valid JSON.`);
      }
    }
    return {
      invocation_id: invocationId,
      inputs: {},
      tweaks,
      pinned_nodes: pinnedByNode,
      human_answers: humanAnswers,
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
          ...(node.data as ProgramNodeData),
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
          data: { ...(node.data as ProgramNodeData), pinned: true, stale: true },
        }
      : node));
    setNotice(`Pinned ${selectedNodeId}. The next run will serve its stale value.`);
  }

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
      const forked = await forkProgramDefinition(
        definition,
        `Fork of ${definition.name}`,
        definition.intent,
      );
      setProgramId(null);
      setDefinition(forked);
      const flow = definitionToFlow(forked, catalogById, { nodes: {} }, toggleNodeCollapsed);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      resetRunState();
      scheduleSave(
        forked,
        { nodes: Object.fromEntries(flow.nodes.map((node) => [node.id, node.position])) },
        null,
      );
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
      const receipt = await materializeProgram(next, programId);
      setDefinition(next);
      const flow = definitionToFlow(next, catalogById, { nodes: {} }, toggleNodeCollapsed);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      resetRunState();
      scheduleSave(
        next,
        { nodes: Object.fromEntries(flow.nodes.map((node) => [node.id, node.position])) },
      );
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
    setPinnedByNode({});
    setSelectedNodeId(null);
  }

  function openStarter(starter: ProgramDefinition): void {
    if (!tenantId) return;
    const next: ProgramDefinition = {
      ...starter,
      tenant_id: tenantId,
      name: `Fork of ${starter.name}`,
      metadata: { ...starter.metadata, draft: true, starter_name: starter.name },
    };
    const flow = definitionToFlow(next, catalogById, { nodes: {} }, toggleNodeCollapsed);
    setProgramId(null);
    setDefinition(next);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    resetRunState();
    scheduleSave(
      next,
      { nodes: Object.fromEntries(flow.nodes.map((node) => [node.id, node.position])) },
      null,
    );
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
    scheduleSave(next, {
      nodes: Object.fromEntries(nodes.map((node) => [node.id, node.position])),
    });
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
        <div className="relative min-h-96 min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onConnectEnd={onConnectEnd}
            onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
            onPaneClick={(event) => {
              setSelectedNodeId(null);
              if (event.detail === 2) {
                setBoundaryShape(undefined);
                setPaletteEntries(null);
                setPendingConnect(null);
                setPaletteOpen(true);
              }
            }}
            fitView
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls showInteractive={false} />
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
            <div className="absolute left-3 top-3 z-20 flex gap-1 rounded-ij-arc border border-ij-seam bg-ij-raised p-1">
              <button
                type="button"
                onClick={() => toggleNodeFlag(selectedNodeId, 'bypassed')}
                className="h-ij-control rounded-ij-arc px-2 text-xs hover:bg-ij-hover-surface"
              >
                {(nodes.find((node) => node.id === selectedNodeId)?.data as ProgramNodeData | undefined)?.bypassed
                  ? 'Enable node'
                  : 'Bypass node'}
              </button>
              <button
                type="button"
                onClick={() => toggleNodeFlag(selectedNodeId, 'muted')}
                className="h-ij-control rounded-ij-arc px-2 text-xs hover:bg-ij-hover-surface"
              >
                {(nodes.find((node) => node.id === selectedNodeId)?.data as ProgramNodeData | undefined)?.muted
                  ? 'Unmute node'
                  : 'Mute node'}
              </button>
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
                  data: { ...(node.data as ProgramNodeData), pinned: false, stale: false },
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
