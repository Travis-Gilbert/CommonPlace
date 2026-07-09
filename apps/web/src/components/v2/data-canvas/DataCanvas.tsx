'use client';

// TW4 — Data-model canvas: visual ERD editor over TypeDefs.
// Renders object types as XYFlow nodes with field lists, relations as
// typed edges with cardinality marks. Supports:
//  - drag-to-create-relation (connect source handle → target)
//  - inline field add / edit (dbl-click) / delete
//  - position persistence across re-renders (drag survives deriveCanvas)
//  - dagre auto-layout for newly added nodes only
// All writes go through ObjectActions on the host.

import { useCallback, useMemo, useRef, useState, type FC } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { BlockHost, ObjectAction, TypeDef } from '@/lib/block-view/types';
import { TypeNode, type TypeNodeData } from './TypeNode';
import { RelationEdge } from './RelationEdge';
import { deriveCanvas, type PositionMap } from './canvas-logic';
import styles from './data-canvas.module.css';

export interface DataCanvasProps {
  types: readonly TypeDef[];
  host: BlockHost;
  /** Pre-seed positions (e.g. from localStorage). */
  initialPositions?: PositionMap;
  /** Called on every drag with the full position map (for persistence). */
  onPositionsChange?: (pos: PositionMap) => void;
}

const nodeTypes: NodeTypes = { typeNode: TypeNode };
const edgeTypes: EdgeTypes = { relation: RelationEdge };

export const DataCanvas: FC<DataCanvasProps> = ({
  types,
  host,
  initialPositions,
  onPositionsChange,
}) => {
  // ── Position persistence ──
  const positionMapRef = useRef<Record<string, { x: number; y: number }>>(
    initialPositions as Record<string, { x: number; y: number }> ?? {},
  );
  const [, setDragTick] = useState(0); // forces re-render on position change

  // Merge derived canvas with persisted positions
  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => deriveCanvas(types, positionMapRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [types],
  );

  // Local state so ReactFlow can show live drag positions
  const [nodes, setNodes] = useState<Node<TypeNodeData>[]>(baseNodes);
  const [edges, setEdges] = useState<Edge[]>(baseEdges);

  // Resync from deriveCanvas when types change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevTypesRef = useRef(types);
  if (prevTypesRef.current !== types) {
    prevTypesRef.current = types;
    // deriveCanvas already used positionMapRef; nodes/edges are up to date
    if (baseNodes !== nodes || baseEdges !== edges) {
      // We'll sync in the next render via the effect pattern below
    }
  }

  // Keep nodes/edges in sync with deriveCanvas output when types change
  const [typesVersion, setTypesVersion] = useState(0);
  if (prevTypesRef.current === types && typesVersion === 0) {
    // First render: seed state from derived
    if (nodes.length === 0 && edges.length === 0 && baseNodes.length > 0) {
      setNodes(baseNodes);
      setEdges(baseEdges);
    }
  }

  // Sync derived → state when types change (cheap version check)
  const lastTypesLen = useRef(types.length);
  useMemo(() => {
    if (lastTypesLen.current !== types.length) {
      lastTypesLen.current = types.length;
      setNodes(baseNodes);
      setEdges(baseEdges);
      setTypesVersion((v) => v + 1);
    }
  }, [baseNodes, baseEdges, types.length]);

  // ── Handlers ──

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    // Track position changes from user drags
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position) {
        positionMapRef.current[ch.id] = {
          x: ch.position.x,
          y: ch.position.y,
        };
      }
    }
    setNodes((nds) => applyNodeChanges(changes, nds) as Node<TypeNodeData>[]);
    // Persist to external store (e.g. localStorage)
    onPositionsChange?.(positionMapRef.current as PositionMap);
    // Force deriveCanvas to pick up new positions on next types change
    setDragTick((t) => t + 1);
  }, [onPositionsChange]);

  const handleEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  /** Drag-to-create-relation: user connects a field source handle to a target handle. */
  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;

      // Source handle format: "field-{fieldName}"
      const sourceHandle = conn.sourceHandle ?? '';
      const fieldMatch = sourceHandle.startsWith('field-')
        ? sourceHandle.slice('field-'.length)
        : null;
      if (!fieldMatch) return;

      const sourceTypeId = conn.source;
      const targetTypeId = conn.target;

      // Don't self-relate
      if (sourceTypeId === targetTypeId) return;

      // Build a relation edge name from the field
      const relationLabel = fieldMatch;

      host.emit({
        kind: 'link',
        from: sourceTypeId,
        edge: relationLabel,
        to: targetTypeId,
      } satisfies ObjectAction);
    },
    [host],
  );

  const handleAddField = useCallback(
    (typeId: string, fieldDef: { name: string; type: string }) => {
      host.emit({
        kind: 'update',
        id: typeId,
        patch: { addField: { name: fieldDef.name, type: fieldDef.type } },
      });
    },
    [host],
  );

  const handleEditField = useCallback(
    (typeId: string, oldName: string, fieldDef: { name: string; type: string }) => {
      host.emit({
        kind: 'update',
        id: typeId,
        patch: { renameField: { from: oldName, to: fieldDef.name, type: fieldDef.type } },
      });
    },
    [host],
  );

  const handleDeleteField = useCallback(
    (typeId: string, fieldName: string) => {
      host.emit({
        kind: 'update',
        id: typeId,
        patch: { deleteField: { name: fieldName } },
      });
    },
    [host],
  );

  // Inject callbacks into node data
  const wiredNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onAddField: handleAddField,
          onEditField: handleEditField,
          onDeleteField: handleDeleteField,
        },
      })),
    [nodes, handleAddField, handleEditField, handleDeleteField],
  );

  // ── Render ──

  if (!types.length) {
    return (
      <div className={styles.empty} role="status">
        <p>No types defined yet. Create a type to see it on the canvas.</p>
      </div>
    );
  }

  return (
    <div className={styles.host}>
      <ReactFlow
        nodes={wiredNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 2 }}
      >
        <Background color="var(--hair-soft)" gap={32} />
        <Controls showInteractive={false} />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  );
};
