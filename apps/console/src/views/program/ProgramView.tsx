// SOURCING: @xyflow/react wrap for the programmable graph canvas.
// ProgramDefinition is typed dataflow; this is not JSON Canvas.

'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import type { BlockHost, ObjectRef, ObjectSet, ViewRenderProps } from '@commonplace/block-view/types';
import { BlockShell } from '@/components/block/BlockShell';
import { ProgramNodeCard, type ProgramNodeData } from './ProgramNodeCard';

const PROGRAM_QUERY = {
  types: ['program', 'program.node', 'program.edge'],
  page: { limit: 500 },
} as const;

const NODE_TYPES = { programNode: ProgramNodeCard } as unknown as NodeTypes;

const KIND_SHAPES: Record<string, string> = {
  source: 'rect',
  sentinel: 'diamond',
  rule: 'hex',
  stochastic: 'ellipse',
  verify: 'shield',
  fold: 'chevron',
  sink: 'trap',
};

function emptySet(): ObjectSet {
  return {
    objects: [],
    shape: { types: [...PROGRAM_QUERY.types], fields: [], relations: [], axes: {}, cardinality: 'empty' },
    subscribe: () => () => {},
  };
}

function queryPrograms(host: BlockHost): ObjectSet {
  const result = host.query(PROGRAM_QUERY);
  if (result instanceof Promise) return emptySet();
  return result;
}

function createStore(host: BlockHost) {
  let current = queryPrograms(host);
  return {
    getSnapshot: () => current,
    subscribe: (onStoreChange: () => void) => {
      current = queryPrograms(host);
      return current.subscribe((next) => {
        current = next;
        onStoreChange();
      });
    },
  };
}

function useProgramObjects(host: BlockHost): ObjectSet {
  const store = useMemo(() => createStore(host), [host]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

function programFlow(objects: readonly ObjectRef[]): {
  nodes: Node<ProgramNodeData>[];
  edges: Edge[];
  contentId: string | null;
  authority: string | null;
} {
  const program = objects.find((object) => object.type === 'program');
  const nodes = objects
    .filter((object) => object.type === 'program.node')
    .map((object, index) => {
      const kind = typeof object.properties.kind === 'string' ? object.properties.kind : 'rule';
      return {
        id: object.id,
        type: 'programNode',
        position: {
          x: typeof object.properties.x === 'number' ? object.properties.x : 48 + (index % 4) * 220,
          y: typeof object.properties.y === 'number' ? object.properties.y : 40 + Math.floor(index / 4) * 140,
        },
        data: {
          label: typeof object.properties.label === 'string' ? object.properties.label : object.id,
          kind,
          shape: KIND_SHAPES[kind] ?? 'rect',
          authority: typeof object.properties.authority === 'string' ? object.properties.authority : null,
        },
      } satisfies Node<ProgramNodeData>;
    });
  const edges = objects
    .filter((object) => object.type === 'program.edge')
    .flatMap((object) => {
      const source = typeof object.properties.from === 'string' ? object.properties.from : null;
      const target = typeof object.properties.to === 'string' ? object.properties.to : null;
      if (!source || !target) return [];
      return [{
        id: object.id,
        source,
        target,
        label: typeof object.properties.port === 'string' ? object.properties.port : undefined,
      } satisfies Edge];
    });
  return {
    nodes,
    edges,
    contentId: typeof program?.properties.content_id === 'string' ? program.properties.content_id : null,
    authority: typeof program?.properties.authority === 'string' ? program.properties.authority : null,
  };
}

function structuralConnectionOk(
  connection: Connection | { source: string | null; target: string | null },
  nodes: readonly Node<ProgramNodeData>[],
): string | null {
  if (!connection.source || !connection.target) {
    return 'Refused: connection needs a source and a target (structural validation only at v1).';
  }
  if (connection.source === connection.target) {
    return 'Refused: a program node cannot connect to itself.';
  }
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target) {
    return 'Refused: both ends must be program nodes.';
  }
  if (source.data.kind === 'sink') {
    return 'Refused: a Sink node cannot be a connection source.';
  }
  if (target.data.kind === 'source') {
    return 'Refused: a Source node cannot be a connection target.';
  }
  return null;
}

export function ProgramView({ host }: ViewRenderProps) {
  const set = useProgramObjects(host);
  const [message, setMessage] = useState<string | null>(null);
  const flow = useMemo(() => programFlow(set.objects), [set.objects]);

  const onConnect = useCallback((connection: Connection) => {
    const refusal = structuralConnectionOk(connection, flow.nodes);
    if (refusal) {
      setMessage(refusal);
      return;
    }
    if (!connection.source || !connection.target) return;
    void host.emit({
      kind: 'link',
      from: connection.source,
      edge: 'PROGRAM_EDGE',
      to: connection.target,
    });
    setMessage(null);
  }, [flow.nodes, host]);

  const isValidConnection = useCallback((connection: Connection | { source: string | null; target: string | null }) => {
    const refusal = structuralConnectionOk(connection, flow.nodes);
    if (refusal) {
      setMessage(refusal);
      return false;
    }
    return true;
  }, [flow.nodes]);

  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    void host.emit({
      kind: 'update',
      id: node.id,
      patch: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
    });
  }, [host]);

  return (
    <BlockShell title="Program" kindGlyph="automation" surfaceClass="editor" bodyBleed="flush">
      <div className="flex h-full min-h-0 flex-col" data-program-graph="">
        <div className="flex items-center gap-3 border-b border-ij-seam px-3 py-2 text-xs text-ij-ink-info">
          <span data-mono-ok className="font-ij-mono">
            content_id: {flow.contentId ?? 'unsaved'}
          </span>
          <span>authority: {flow.authority ?? 'advisory'}</span>
          <span>validation: structural only (v1)</span>
          {message ? <span className="text-ij-warn">{message}</span> : null}
        </div>
        <div className="relative min-h-0 flex-1">
          {flow.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-ij-ink-info">
              No program loaded from the substrate. Open a program object to render nodes and edges.
            </div>
          ) : (
            <ReactFlow
              nodes={flow.nodes}
              edges={flow.edges}
              nodeTypes={NODE_TYPES}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onNodeDragStop={onNodeDragStop}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          )}
        </div>
      </div>
    </BlockShell>
  );
}
