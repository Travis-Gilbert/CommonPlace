'use client';

// TW4 data-model canvas: visual ERD editor over TypeDefs.
// Renders object types as XYFlow nodes with field lists, relations as
// typed edges with cardinality marks. Supports:
//  - drag-to-create-relation (connect source handle → target)
//  - inline field add / edit (dbl-click) / delete
//  - position persistence across re-renders (drag survives deriveCanvas)
//  - dagre auto-layout for newly added nodes only
// All writes go through ObjectActions on the host.

import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
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
import { deriveCanvas, typesSignature, type PositionMap } from './canvas-logic';
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
  // Own a private copy of the seed positions so the mirror effect below can
  // record on-screen positions into it without mutating the caller's object.
  const positionMapRef = useRef<Record<string, { x: number; y: number }>>({
    ...((initialPositions as Record<string, { x: number; y: number }>) ?? {}),
  });

  // Structural signature of the type set: changes on any content edit (field
  // add / edit / delete, relation link, type create / delete), not just on
  // types.length. The resync effect keys off this, so a content edit that
  // keeps the count constant (a link-create, an inline field add) is never
  // missed the way a length gate would miss it.
  const signature = useMemo(() => typesSignature(types), [types]);

  // Local state so ReactFlow can show live drag positions. Seeded from the
  // initialPositions prop (never the ref, so nothing is read during render);
  // later updates flow through the resync effect.
  const [nodes, setNodes] = useState<Node<TypeNodeData>[]>(
    () => deriveCanvas(types, initialPositions ?? {}).nodes,
  );
  const [edges, setEdges] = useState<Edge[]>(
    () => deriveCanvas(types, initialPositions ?? {}).edges,
  );

  // Mirror on-screen node positions into the position map after every node
  // change (drag or resync), so the map always holds each node's current
  // position. A later resync then keeps existing nodes exactly where they sit
  // and only a brand-new type gets a fresh dagre layout.
  useEffect(() => {
    for (const n of nodes) {
      positionMapRef.current[n.id] = { x: n.position.x, y: n.position.y };
    }
  }, [nodes]);

  // Resync nodes/edges whenever the structural signature changes. Re-deriving
  // with the position map (kept current above) preserves every existing
  // node's position, so an edit never resets the dagre layout. Guarded so the
  // mount run is a no-op.
  const prevSignatureRef = useRef(signature);
  useEffect(() => {
    if (prevSignatureRef.current === signature) return;
    prevSignatureRef.current = signature;
    const next = deriveCanvas(types, positionMapRef.current);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [signature, types]);

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
    // Persist to external store (e.g. localStorage). Pass a fresh snapshot, not
    // the long-lived ref: a consumer that stores this in React state needs a new
    // reference to observe the change, and must not hold a later-mutated object.
    onPositionsChange?.({ ...positionMapRef.current } as PositionMap);
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
