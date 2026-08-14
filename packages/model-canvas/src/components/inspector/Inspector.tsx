// SOURCING: OWOX/models Inspector (Apache-2.0). Gemini QuestionsPanel gutted.

import { useRef, useState, useCallback, useEffect } from 'react';
import { PanelRightOpen } from 'lucide-react';
import type { ModelNode, ModelEdge } from '@commonplace/okf';
import { ObjectInspector } from './ObjectInspector';
import { RelationshipInspector } from './RelationshipInspector';
import { joinFieldType } from '../../lib/joinFieldType';

type Selection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | null;

interface InspectorProps {
  selection: Selection;
  nodes: ModelNode[];
  edges: ModelEdge[];
  onUpdateNode: (key: string, patch: Partial<ModelNode>) => void;
  onUpdateEdge: (id: string, patch: Partial<ModelEdge>) => void;
  onClose: () => void;
  /**
   * When true, render only the selection body — no outer drawer wrapper.
   * Used when hosted inside ModelSheet.
   */
  embedded?: boolean;
}

const MIN_WIDTH = 320;

function EmptyState() {
  return (
    <div className="px-6 py-[46px] text-center text-[13px] leading-[1.6] text-[color:var(--ij-text-secondary,#64748b)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        width={42}
        height={42}
        className="mx-auto mb-3 opacity-35"
      >
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="4" width="7" height="6" rx="1.5" />
        <rect x="9" y="14" width="7" height="6" rx="1.5" />
      </svg>
      <div>
        Select an object or relationship to edit.
        <br />
        <br />
        Declare writes land in the schema registry.
      </div>
    </div>
  );
}

function ReopenTab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Open inspector"
      aria-label="Open inspector"
      className="group absolute right-0 top-1/2 z-20 flex h-[46px] w-[32px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-xl border border-r-0 border-[color:var(--ij-border,#d8dee8)] bg-[color:var(--ij-editor,#fff)] text-[color:var(--ij-text-secondary,#64748b)] shadow-[-3px_0_12px_rgba(15,23,42,0.07)] transition-colors hover:bg-[color:var(--ij-hover-surface,#f1f3f7)] hover:text-[color:var(--ij-link,#1e88e5)]"
    >
      <PanelRightOpen size={18} />
    </button>
  );
}

export function Inspector({
  selection,
  nodes,
  edges,
  onUpdateNode,
  onUpdateEdge,
  onClose,
  embedded = false,
}: InspectorProps) {
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(320);
  const drawerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const selectedNode = selection?.type === 'node'
    ? nodes.find((n) => n.key === selection.id)
    : undefined;
  const selectedEdge = selection?.type === 'edge'
    ? edges.find((e) => e.id === selection.id)
    : undefined;

  const title = selectedNode
    ? (selectedNode.title.trim() || 'Untitled')
    : selectedEdge
      ? 'Relationship'
      : 'Inspector';

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.min(
        window.innerWidth * 0.5,
        Math.max(MIN_WIDTH, startWidthRef.current + delta),
      );
      setWidth(newWidth);
    }
    function onMouseUp() {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const body = selectedNode ? (
    <ObjectInspector
      node={selectedNode}
      onUpdate={(patch) => onUpdateNode(selectedNode.key, patch)}
    />
  ) : selectedEdge ? (
    <RelationshipInspector
      edge={selectedEdge}
      fromNode={nodes.find((n) => n.key === selectedEdge.from)}
      toNode={nodes.find((n) => n.key === selectedEdge.to)}
      onUpdate={(patch) => onUpdateEdge(selectedEdge.id, patch)}
      onEnsureField={(nodeKey, fieldName) => {
        const node = nodes.find((n) => n.key === nodeKey);
        if (!node || !fieldName || node.schema.some((f) => f.name === fieldName)) return;
        const type = joinFieldType(nodes, [selectedEdge], nodeKey, fieldName);
        onUpdateNode(nodeKey, {
          schema: [...node.schema, { name: fieldName, type, pk: false }],
        });
      }}
    />
  ) : (
    <EmptyState />
  );

  if (embedded) return body;

  if (!open) {
    return (
      <div className="relative flex-shrink-0" style={{ width: 0 }}>
        <ReopenTab onClick={() => setOpen(true)} />
      </div>
    );
  }

  return (
    <div
      ref={drawerRef}
      className="relative z-10 flex flex-shrink-0 flex-col border-l border-[color:var(--ij-border,#d8dee8)] bg-[color:var(--ij-editor,#fff)] shadow-[-4px_0_16px_rgba(15,23,42,0.04)]"
      style={{ width, minWidth: MIN_WIDTH }}
    >
      <div
        onMouseDown={onResizeMouseDown}
        className="group absolute left-0 top-0 z-[18] h-full w-[7px] cursor-col-resize"
        title="Drag to resize"
      >
        <div className="absolute left-[2px] top-0 h-full w-[2px] bg-transparent transition-colors group-hover:bg-[color:var(--ij-link,#1e88e5)]" />
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-[color:var(--ij-border,#d8dee8)] px-4 py-[14px]">
        <h3 className="flex-1 text-[13.5px] font-[650] text-[color:var(--ij-ink,#0f172a)]">{title}</h3>
        <button
          type="button"
          onClick={() => {
            onClose();
            setOpen(false);
          }}
          title="Close inspector"
          className="cursor-pointer border-none bg-transparent p-0 text-[18px] leading-none text-[color:var(--ij-text-secondary,#64748b)] transition-colors hover:text-[color:var(--ij-ink,#0f172a)]"
        >
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{body}</div>
    </div>
  );
}
