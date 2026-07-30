import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { KeyRound, ChevronDown, ChevronRight } from "lucide-react";
import type { ModelNode, SchemaField } from "@commonplace/okf";
import type { ViewMode } from "../../state/viewMode";
import { NOTHING_HIDDEN, type ObjHidden } from "../../state/objLabels";
import { DataMartIcon } from "../../lib/icons";
import { ERD_COLLAPSED_ROWS } from "./layoutSize";

const STATUS_TIP: Record<string, string> = {
  created: "Declared in registry",
  pending: "Observed only -- not declared",
  creating: "Declaring…",
  error: "Declaration refused",
};

export type MartNodeData = ModelNode & {
  _viewMode?: ViewMode;
  _keyFields?: string[];
  _objHidden?: ObjHidden;
  /** MC5 live record count from registry. */
  _recordCount?: number;
  /** MC4 ghost: observed-only type. */
  _ghost?: boolean;
  _coverage?: number;
  _pendingDeclare?: boolean;
  _divergenceCount?: number;
  /** MF4 Declare (pin) -- replaces upstream product push. */
  _onDeclare?: () => void;
};

function StatusDot({ status }: { status: string }) {
  const base = "absolute right-2.5 top-2.5 z-10 size-2.5 rounded-full";
  const colors: Record<string, string> = {
    created: "bg-ij-ok",
    pending: "bg-ij-ink-disabled",
    creating: "animate-pulse bg-ij-accent",
    error: "bg-ij-error",
  };
  return (
    <span
      data-testid="status-dot"
      className={`${base} ${colors[status] ?? "bg-ij-ink-disabled"}`}
      title={STATUS_TIP[status] ?? status}
    />
  );
}

// Node-level connectable ports (the only way to draw a new relationship).
function NodePorts() {
  const common = {
    width: 13, height: 13, borderRadius: "50%",
    background: "var(--ij-editor)", border: "2px solid var(--ij-accent)",
    top: 24, opacity: 0, transition: "opacity 0.12s",
  } as const;
  return (
    <>
      <Handle type="source" position={Position.Left} id="left" style={{ ...common, left: -7 }} className="mart-handle" />
      <Handle type="source" position={Position.Right} id="right" style={{ ...common, right: -7 }} className="mart-handle" />
    </>
  );
}

function MartHeader({ node, showAccent }: { node: MartNodeData; showAccent: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-2 pt-3">
      {showAccent ? <span className="min-h-5 w-1 shrink-0 self-stretch rounded-sm bg-ij-graph" /> : null}
      <DataMartIcon size={15} className="shrink-0 text-ij-ink-info" />
      <span className="line-clamp-2 flex-1 pr-3 text-sm font-semibold leading-tight text-ij-ink">
        {node.title}
      </span>
    </div>
  );
}

// Display-only anchor handles on a field row. isConnectable={false} keeps them
// from starting new connections -- they only give existing edges a place to land.
function FieldAnchors({ name }: { name: string }) {
  const base = { width: 1, height: 1, minWidth: 0, minHeight: 0, background: "transparent", border: "none", top: "50%" } as const;
  return (
    <>
      <Handle type="source" position={Position.Left} id={`fl:${name}`} isConnectable={false} style={{ ...base, left: 0 }} />
      <Handle type="source" position={Position.Right} id={`fr:${name}`} isConnectable={false} style={{ ...base, right: 0 }} />
    </>
  );
}

function FieldRow({ f }: { f: SchemaField }) {
  return (
    <div className="relative flex items-center gap-2 border-b border-ij-seam px-3 py-1 text-xs last:border-b-0">
      <FieldAnchors name={f.name} />
      {f.pk
        ? <KeyRound size={11} className="shrink-0 text-ij-gold" />
        : <span className="w-3 shrink-0" />}
      <span className="flex-1 truncate text-ij-ink" title={f.alias || f.name}>{f.alias || f.name}</span>
      <span className="truncate font-ij-mono text-xs text-ij-ink-info">{f.type}</span>
    </div>
  );
}

// ERD body shows at most ERD_COLLAPSED_ROWS fields by default so dense marts stay
// readable; the rest hide behind a "+N more" toggle. PK and relationship-key
// fields are always kept in the visible set so their edge handles exist even
// while collapsed (edges anchor to those field rows).
function ErdBody({ node }: { node: MartNodeData }) {
  const [expanded, setExpanded] = useState(false);
  const schema = node.schema;
  if (schema.length === 0) {
    return <div className="px-3 pb-2 text-xs text-ij-ink-info">no fields</div>;
  }

  const keyFields = new Set(node._keyFields ?? []);
  const isKey = (f: SchemaField) => f.pk || keyFields.has(f.name);
  // Keys first, then the rest -- keeps a stable order whether collapsed or expanded.
  const ordered = [...schema.filter(isKey), ...schema.filter(f => !isKey(f))];
  const collapsedCount = Math.max(ERD_COLLAPSED_ROWS, ordered.filter(isKey).length);
  const visible = expanded ? ordered : ordered.slice(0, collapsedCount);
  const hidden = schema.length - collapsedCount;

  return (
    <div className="border-t border-ij-seam">
      {visible.map(f => <FieldRow key={f.name} f={f} />)}
      {hidden > 0 && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className="flex w-full items-center justify-center gap-1 border-t border-ij-seam px-3 py-1 text-xs font-medium text-ij-accent hover:bg-ij-hover-surface"
        >
          {expanded
            ? <><ChevronDown size={12} /> Show less</>
            : <><ChevronRight size={12} /> +{hidden} more field{hidden > 1 ? "s" : ""}</>}
        </button>
      )}
    </div>
  );
}

function MartNodeInner({ data }: NodeProps) {
  const node = data as unknown as MartNodeData;
  const viewMode = node._viewMode ?? "compact";
  const isErd = viewMode === "erd";
  const hidden = node._objHidden ?? NOTHING_HIDDEN;
  // The source badge and the header accent stripe both encode inputSource
  // colour, so they show and hide together.
  const withSource = !hidden.source;
  const withFieldCount = !isErd && !hidden.fields;
  const withStatus = !hidden.status;
  const fieldCount = node.schema?.length ?? 0;
  const fieldText = fieldCount > 0 ? `${fieldCount} field${fieldCount > 1 ? "s" : ""}` : "no fields";

  const ghost = Boolean(node._ghost);
  const border = ghost
    ? "border-dashed border-ij-ink-disabled opacity-90"
    : "border-ij-seam-raised hover:border-ij-control-border";

  return (
    <div
      className={`relative cursor-grab select-none rounded-ij-arc border bg-ij-raised font-ij-ui text-ij-ink ${border} ${isErd ? "w-64" : "w-52"}`}
      data-ghost={ghost ? "true" : undefined}
    >
      {withStatus && <StatusDot status={node.status} />}
      <MartHeader node={node} showAccent={withSource && !ghost} />

      <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
        {ghost ? (
          <span className="rounded-full bg-ij-row-gray px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-ij-ink-info">
            observed
          </span>
        ) : withSource ? (
          <span className="rounded-full bg-ij-row-gray px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-ij-ink-info">
            {node.inputSource}
          </span>
        ) : null}
        {typeof node._recordCount === "number" ? (
          <span className="text-xs text-ij-ink-info">· {node._recordCount}</span>
        ) : withFieldCount ? (
          <span className="text-xs text-ij-ink-info">{fieldText}</span>
        ) : null}
        {typeof node._coverage === "number" ? (
          <span className="text-xs text-ij-ink-info">{Math.round(node._coverage * 100)}%</span>
        ) : null}
        {(node._divergenceCount ?? 0) > 0 ? (
          <span className="rounded bg-ij-warn-bg px-1.5 py-0.5 text-xs font-semibold text-ij-warn">
            {node._divergenceCount} diverge
          </span>
        ) : null}
      </div>

      {isErd && <ErdBody node={node} />}

      {ghost && node._onDeclare ? (
        <div className="border-t border-ij-seam px-3 py-2">
          <button
            type="button"
            disabled={node._pendingDeclare}
            onClick={(e) => {
              e.stopPropagation();
              node._onDeclare?.();
            }}
            className="w-full rounded-ij-arc border border-ij-control-border py-1.5 text-xs font-medium hover:bg-ij-hover-surface disabled:opacity-50"
          >
            {node._pendingDeclare ? "Declaring…" : "Declare"}
          </button>
        </div>
      ) : null}

      <NodePorts />
    </div>
  );
}

export const MartNode = memo(MartNodeInner);
