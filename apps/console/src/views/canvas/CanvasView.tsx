// SOURCING: @xyflow/react wrap. React Flow provides pan, zoom, selection, and edge routing.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Controls,
  ReactFlow,
  type Connection,
  type Node,
  type NodeTypes,
  type OnNodeDrag,
} from '@xyflow/react';
import type { BlockHost, ObjectSet, ViewRenderProps } from '@commonplace/block-view/types';
import { parseCanvasText, serializeCanvas, toJsonCanvas } from '@commonplace/json-canvas';
import { CanvasCardNode } from './CanvasCardNode';
import { CanvasPaperGround } from './CanvasPaperGround';
import { canvasFlowFromObjects, canvasFromObjects } from './canvas-flow';

const CANVAS_QUERY = {
  types: ['canvas', 'canvas.card', 'canvas.group', 'canvas.connection'],
  page: { limit: 500 },
} as const;

const NODE_TYPES = { canvasCard: CanvasCardNode } as unknown as NodeTypes;

function queryCanvas(host: BlockHost): ObjectSet {
  const result = host.query(CANVAS_QUERY);
  if (result instanceof Promise) {
    return {
      objects: [],
      shape: { types: [...CANVAS_QUERY.types], fields: [], relations: [], axes: {}, cardinality: 'empty' },
      subscribe: () => () => {},
    };
  }
  return result;
}

export function CanvasView({ host }: ViewRenderProps) {
  const [set, setSet] = useState<ObjectSet>(() => queryCanvas(host));
  const [message, setMessage] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const current = queryCanvas(host);
    setSet(current);
    return current.subscribe(setSet);
  }, [host]);

  const flow = useMemo(() => canvasFlowFromObjects(set.objects), [set.objects]);

  const onNodeDragStop: OnNodeDrag<Node> = useCallback((_, node) => {
    void host.emit({ kind: 'update', id: node.id, patch: { x: Math.round(node.position.x), y: Math.round(node.position.y) } });
  }, [host]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    void host.emit({
      kind: 'link',
      from: connection.source,
      edge: 'CANVAS_CONNECT',
      to: connection.target,
    });
  }, [host]);

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
        <CanvasPaperGround className="pointer-events-none absolute inset-0 z-0" />
        <div className="relative z-10 h-full min-h-0">
          {flow.nodes.some((node) => node.type === 'canvasCard') ? (
            <ReactFlow
              nodes={flow.nodes}
              edges={flow.edges}
              nodeTypes={NODE_TYPES}
              fitView
              nodesConnectable
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              proOptions={{ hideAttribution: true }}
              style={{ background: 'transparent' }}
            >
              <Controls showInteractive={false} />
            </ReactFlow>
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-ij-ink-info">
              No cards on this canvas. Import a .canvas file or place graph objects.
            </div>
          )}
        </div>
      </main>
    </section>
  );
}
