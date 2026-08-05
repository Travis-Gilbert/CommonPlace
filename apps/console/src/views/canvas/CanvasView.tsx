// SOURCING: @xyflow/react wrap. React Flow provides pan, zoom, selection, and edge routing.
'use client';

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Controls,
  ReactFlow,
  type Connection,
  type Node,
  type NodeTypes,
  type OnNodeDrag,
  type ReactFlowInstance,
} from '@xyflow/react';
import type { BlockHost, ObjectSet, ViewRenderProps } from '@commonplace/block-view/types';
import { CANVAS_CONNECT_EDGE, parseCanvasText, serializeCanvas, toJsonCanvas } from '@commonplace/json-canvas';
import { CanvasCardNode } from './CanvasCardNode';
import { CanvasPaperGround } from './CanvasPaperGround';
import { canvasDropAction } from './canvas-drop';
import {
  canvasFlowFromObjects,
  canvasFromObjects,
  type CanvasCardData,
} from './canvas-flow';

const CANVAS_QUERY = {
  types: ['canvas', 'canvas.card', 'canvas.group', 'canvas.connection'],
  page: { limit: 500 },
} as const;

const NODE_TYPES = { canvasCard: CanvasCardNode } as unknown as NodeTypes;
type CanvasFlowNode = Node<CanvasCardData>;
function emptyCanvasSet(): ObjectSet {
  return {
    objects: [],
    shape: { types: [...CANVAS_QUERY.types], fields: [], relations: [], axes: {}, cardinality: 'empty' },
    subscribe: () => () => {},
  };
}

function queryCanvas(host: BlockHost): ObjectSet {
  const result = host.query(CANVAS_QUERY);
  if (result instanceof Promise) return emptyCanvasSet();
  return result;
}

function createCanvasStore(host: BlockHost) {
  let current = queryCanvas(host);
  return {
    getSnapshot: () => current,
    subscribe: (onStoreChange: () => void) => {
      current = queryCanvas(host);
      return current.subscribe((next) => {
        current = next;
        onStoreChange();
      });
    },
  };
}

function useCanvasObjectSet(host: BlockHost): ObjectSet {
  const store = useMemo(() => createCanvasStore(host), [host]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function CanvasView({
  host,
  /** Hide Import/Export chrome — used when the canvas is a capability inside another shell. */
  embedded = false,
}: Pick<ViewRenderProps, 'host'> & { embedded?: boolean; set?: ObjectSet }) {
  const set = useCanvasObjectSet(host);
  const [message, setMessage] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const flowInstanceRef = useRef<ReactFlowInstance<CanvasFlowNode> | null>(null);
  const flow = useMemo(() => canvasFlowFromObjects(set.objects), [set.objects]);

  const onNodeDragStop: OnNodeDrag<CanvasFlowNode> = useCallback((_, node) => {
    const intersecting = flowInstanceRef.current?.getIntersectingNodes(node) ?? [];
    void host.emit(canvasDropAction(node, intersecting));
  }, [host]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) {
      setMessage('Refused: a card cannot relate to itself.');
      return;
    }
    void host.emit({
      kind: 'link',
      from: connection.source,
      edge: CANVAS_CONNECT_EDGE,
      to: connection.target,
    });
    setMessage(null);
  }, [host]);

  const isValidConnection = useCallback((connection: Connection | { source: string | null; target: string | null }) => {
    if (!connection.source || !connection.target) {
      setMessage('Refused: connection needs a source and a target.');
      return false;
    }
    if (connection.source === connection.target) {
      setMessage('Refused: a card cannot relate to itself.');
      return false;
    }
    return true;
  }, []);

  const onImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const document = parseCanvasText(await file.text());
      const result = await host.emit({
        kind: 'invoke_tool',
        tool: 'canvas.apply_json',
        args: { canvasId: flow.canvasId, document: document as never },
      });
      setMessage(result.ok ? 'Canvas imported.' : result.error ?? 'Canvas import was refused.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Canvas import failed.');
    }
  }, [flow.canvasId, host]);

  const onExport = useCallback(() => {
    const canvas = canvasFromObjects(set.objects);
    if (!canvas) {
      setMessage('No canvas is available to export.');
      return;
    }
    const file = new Blob([serializeCanvas(toJsonCanvas(canvas))], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${canvas.id}.canvas`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Canvas exported.');
  }, [set.objects]);

  const hasCards = flow.nodes.some((node) => node.type === 'canvasCard');

  const flowSurface = (
    <div className="relative h-full min-h-0 w-full" aria-label="JSON Canvas">
      {!embedded ? <CanvasPaperGround className="pointer-events-none absolute inset-0 z-0" /> : null}
      <div className={embedded ? 'h-full min-h-0' : 'relative z-10 h-full min-h-0'}>
        {embedded || hasCards ? (
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={NODE_TYPES}
            onInit={(instance) => {
              flowInstanceRef.current = instance;
            }}
            fitView={hasCards}
            nodesConnectable
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            proOptions={{ hideAttribution: true }}
            style={{ background: 'transparent' }}
          >
            {embedded ? null : <Controls showInteractive={false} />}
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-muted-foreground">
            Drop or place objects on the canvas.
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    // Capability surface for shells that own their own chrome (no Import/Export,
    // no empty-state copy). Empty = transparent React Flow pane.
    return (
      <div className="h-full min-h-0 w-full" data-canvas-view data-canvas-embedded="true">
        {flowSurface}
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-ij-editor text-ij-ink" data-canvas-view>
      <header className="flex shrink-0 items-center gap-2 border-b border-ij-seam bg-ij-chrome px-3 py-2">
        <h2 className="font-medium">Canvas</h2>
        <div className="ml-auto flex items-center gap-2">
          <input ref={importRef} type="file" accept=".canvas,application/json" className="sr-only" onChange={onImport} />
          <button type="button" className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface" onClick={() => importRef.current?.click()}>
            Import
          </button>
          <button type="button" className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 hover:bg-ij-hover-surface" onClick={onExport}>
            Export
          </button>
        </div>
      </header>
      {message ? <p className="shrink-0 border-b border-ij-seam px-3 py-1 text-ij-ink-info" role="status">{message}</p> : null}
      <main className="relative min-h-0 flex-1" aria-label="Canvas graph">
        {flowSurface}
      </main>
    </section>
  );
}
