'use client';

/**
 * WS4: the JSON Canvas board renderer for the `board` work-surface stage.
 * Loads a `.canvas` document from /api/work/board, renders it with
 * @xyflow/react (already a dependency; conventions follow
 * ReactFlowModelCanvas.tsx), persists edits back through the same route
 * (debounced autosave), and live-reloads via the /watch SSE endpoint so a
 * second tab/window picks up changes. See lib/work-surface/board-store.ts
 * for the disclosed local-filesystem persistence scope.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import debounce from 'lodash/debounce';
import { FileText, Link2, Plus } from 'lucide-react';
import {
  addTextNode,
  applyNodePositions,
  canvasToFlow,
  DEFAULT_BOARD_ID,
  removeNodes,
  resolveNodeColor,
  updateNodeText,
  type BoardNodeData,
} from '@/lib/work-surface/board-flow';
import { EMPTY_CANVAS, type FileCanvasNode, type GroupCanvasNode, type JSONCanvas, type LinkCanvasNode, type TextCanvasNode } from '@/lib/work-surface/json-canvas';
import styles from './board.module.css';

interface WorkBoardProps {
  /** Backing board id; defaults to the single shared board until WS6 mints per-Item ids. */
  boardId?: string;
}

type BoardData = BoardNodeData & {
  onTextChange?: (id: string, text: string) => void;
};
type BoardNode = Node<BoardData>;

function SideHandles() {
  return (
    <>
      <Handle className={styles.handle} type="target" position={Position.Top} id="top-target" />
      <Handle className={styles.handle} type="source" position={Position.Top} id="top-source" />
      <Handle className={styles.handle} type="target" position={Position.Right} id="right-target" />
      <Handle className={styles.handle} type="source" position={Position.Right} id="right-source" />
      <Handle className={styles.handle} type="target" position={Position.Bottom} id="bottom-target" />
      <Handle className={styles.handle} type="source" position={Position.Bottom} id="bottom-source" />
      <Handle className={styles.handle} type="target" position={Position.Left} id="left-target" />
      <Handle className={styles.handle} type="source" position={Position.Left} id="left-source" />
    </>
  );
}

function accentStyle(color: string | undefined): CSSProperties | undefined {
  return color ? ({ '--node-accent': color } as CSSProperties) : undefined;
}

function ColorDot({ color }: { color: string | undefined }) {
  if (!color) return null;
  return <span className={styles.colorDot} style={accentStyle(color)} />;
}

function TextNodeView({ id, data, selected }: NodeProps<BoardNode>) {
  const node = data.node as TextCanvasNode;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.text);
  // Resync the draft with the source text whenever it changes externally
  // (SSE reload, another tab's edit) without editing in progress. This is
  // the "adjust state during render" pattern React recommends in place of
  // an effect for deriving state from a changing prop.
  const [syncedText, setSyncedText] = useState(node.text);
  if (!editing && node.text !== syncedText) {
    setSyncedText(node.text);
    setDraft(node.text);
  }

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== node.text) data.onTextChange?.(id, draft);
  }, [data, draft, id, node.text]);

  return (
    <div className={styles.node} data-selected={selected || undefined} onDoubleClick={() => setEditing(true)}>
      <SideHandles />
      <ColorDot color={resolveNodeColor(node.color)} />
      {editing ? (
        <textarea
          className={styles.textEdit}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(node.text);
              setEditing(false);
            }
          }}
        />
      ) : (
        <p className={styles.textContent}>
          {node.text || <span className={styles.textEmpty}>Double-click to write a note.</span>}
        </p>
      )}
    </div>
  );
}

function FileNodeView({ data, selected }: NodeProps<BoardNode>) {
  const node = data.node as FileCanvasNode;
  return (
    <div className={styles.node} data-selected={selected || undefined}>
      <SideHandles />
      <div className={styles.nodeHead}>
        <FileText size={13} />
        <span className={styles.nodeKicker}>File</span>
        <ColorDot color={resolveNodeColor(node.color)} />
      </div>
      <p className={styles.nodePath}>
        {node.file}
        {node.subpath ? <span className={styles.nodeSubpath}>{node.subpath}</span> : null}
      </p>
    </div>
  );
}

function LinkNodeView({ data, selected }: NodeProps<BoardNode>) {
  const node = data.node as LinkCanvasNode;
  return (
    <div className={styles.node} data-selected={selected || undefined}>
      <SideHandles />
      <div className={styles.nodeHead}>
        <Link2 size={13} />
        <span className={styles.nodeKicker}>Link</span>
        <ColorDot color={resolveNodeColor(node.color)} />
      </div>
      <a className={styles.nodeLink} href={node.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {node.url}
      </a>
    </div>
  );
}

function GroupNodeView({ data }: NodeProps<BoardNode>) {
  const node = data.node as GroupCanvasNode;
  return (
    <div className={styles.groupNode}>
      <SideHandles />
      {node.label ? <span className={styles.groupLabel}>{node.label}</span> : null}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  text: TextNodeView,
  file: FileNodeView,
  link: LinkNodeView,
  group: GroupNodeView,
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function WorkBoard({ boardId = DEFAULT_BOARD_ID }: WorkBoardProps) {
  const [canvas, setCanvas] = useState<JSONCanvas>(EMPTY_CANVAS);
  // No 'loading' reset is done inside an effect: WorkStageHost mounts this
  // component with key={boardId}, so a board-id change remounts it and
  // 'loading' is simply this state's initial value again.
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const lastSavedAtRef = useRef(0);

  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // saveNow is the only place that touches lastSavedAtRef/setSaveStatus; it's
  // an event-handler-shaped useCallback (invoked from commit(), never during
  // render) so ref/state writes inside it are safe by the rules-of-hooks.
  const saveNow = useCallback(async (next: JSONCanvas, id: string) => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/work/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, canvas: next }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      lastSavedAtRef.current = Date.now();
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);

  // The debounced wrapper is built in an effect (not useMemo) and stashed in
  // a ref: constructing it during render would count as a render-phase read
  // of saveNow's ref-touching closure, which the rules-of-hooks forbid.
  const persistRef = useRef<ReturnType<typeof debounce<typeof saveNow>> | null>(null);
  useEffect(() => {
    const debounced = debounce(saveNow, 500);
    persistRef.current = debounced;
    return () => debounced.cancel();
  }, [saveNow]);

  const commit = useCallback(
    (next: JSONCanvas) => {
      setCanvas(next);
      persistRef.current?.(next, boardId);
    },
    [boardId],
  );

  const handleTextChange = useCallback(
    (id: string, text: string) => commit(updateNodeText(canvas, id, text)),
    [canvas, commit],
  );

  // Load the board once per mount (a board-id change remounts via key=).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/work/board?id=${encodeURIComponent(boardId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        return res.json();
      })
      .then((body: { canvas: JSONCanvas }) => {
        if (cancelled) return;
        setCanvas(body.canvas);
        setLoadState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load board.');
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  // Live reload: another tab/window saving the same board file refetches it here.
  useEffect(() => {
    const source = new EventSource(`/api/work/board/watch?id=${encodeURIComponent(boardId)}`);
    const onChanged = () => {
      if (Date.now() - lastSavedAtRef.current < 1500) return; // our own recent save
      fetch(`/api/work/board?id=${encodeURIComponent(boardId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { canvas: JSONCanvas } | null) => {
          if (body) setCanvas(body.canvas);
        })
        .catch(() => {
          // Live reload is best-effort; the next successful load or save recovers.
        });
    };
    source.addEventListener('changed', onChanged);
    return () => source.close();
  }, [boardId]);

  // Re-derive React Flow nodes/edges whenever the canvas model changes.
  useEffect(() => {
    const flow = canvasToFlow(canvas);
    setNodes(
      flow.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        style: n.style,
        zIndex: n.zIndex,
        data: { ...n.data, onTextChange: handleTextChange },
        draggable: n.type !== 'group',
      })),
    );
    setEdges(
      flow.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: 'smoothstep',
        style: { stroke: resolveNodeColor(e.data.color) ?? 'var(--hair)' },
        markerEnd: e.data.toEnd === 'arrow' ? { type: 'arrowclosed' as const } : undefined,
        markerStart: e.data.fromEnd === 'arrow' ? { type: 'arrowclosed' as const } : undefined,
      })),
    );
  }, [canvas, handleTextChange, setEdges, setNodes]);

  const handleNodeDragStop = useCallback(
    (_: unknown, node: BoardNode) => commit(applyNodePositions(canvas, new Map([[node.id, node.position]]))),
    [canvas, commit],
  );

  const handleNodesDelete = useCallback(
    (deleted: BoardNode[]) => commit(removeNodes(canvas, deleted.map((n) => n.id))),
    [canvas, commit],
  );

  const handleAddNote = useCallback(() => {
    const id = `text-${Date.now().toString(36)}`;
    commit(addTextNode(canvas, { id, x: 80 + Math.round(Math.random() * 120), y: 80 + Math.round(Math.random() * 120) }));
  }, [canvas, commit]);

  if (loadState === 'error') {
    return <div className={styles.stateMessage}>Couldn&apos;t load the board: {loadError}</div>;
  }

  return (
    <div className={styles.host}>
      <ReactFlow<BoardNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodesDelete={handleNodesDelete}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--hair-soft)" gap={24} />
        <MiniMap zoomable pannable />
        <Controls showInteractive={false} />
        <Panel position="top-right" className={styles.toolbar}>
          <button type="button" className={styles.addButton} onClick={handleAddNote}>
            <Plus size={13} /> Note
          </button>
          <span className={styles.status} data-status={saveStatus}>
            {loadState === 'loading' ? 'Loading…' : SAVE_STATUS_LABEL[saveStatus]}
          </span>
        </Panel>
      </ReactFlow>
    </div>
  );
}

const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  idle: 'Ready',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};
